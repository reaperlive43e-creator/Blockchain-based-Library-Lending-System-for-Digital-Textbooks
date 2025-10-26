import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  ClarityValue,
  stringUtf8CV,
  uintCV,
  principalCV,
  tupleCV,
  listCV,
  booleanCV,
  bufferCV,
} from "@stacks/transactions";

interface Loan {
  startTime: number;
  duration: number;
  accessKey: Buffer;
  extended: boolean;
  amountPaid: number;
}

interface LoanHistoryEntry {
  timestamp: number;
  action: string;
  success: boolean;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class TimedAccessMock {
  state: {
    loanCounter: number;
    maxLoanDuration: number;
    extensionFee: number;
    authorityContract: string | null;
    loans: Map<string, Loan>;
    loanHistory: Map<string, LoanHistoryEntry[]>;
  } = {
    loanCounter: 0,
    maxLoanDuration: 43200,
    extensionFee: 1000,
    authorityContract: null,
    loans: new Map(),
    loanHistory: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  libraryPrincipal: string = "ST1LIBRARY";
  paymentGateway = { processPayment: vi.fn().mockReturnValue(true) };
  textbookNFT = { getOwner: vi.fn().mockReturnValue("ST1OWNER") };

  reset() {
    this.state = {
      loanCounter: 0,
      maxLoanDuration: 43200,
      extensionFee: 1000,
      authorityContract: null,
      loans: new Map(),
      loanHistory: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.paymentGateway.processPayment.mockReset();
    this.paymentGateway.processPayment.mockReturnValue(true);
    this.textbookNFT.getOwner.mockReset();
    this.textbookNFT.getOwner.mockReturnValue("ST1OWNER");
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (
      contractPrincipal === "SP000000000000000000002Q6VF78" ||
      this.state.authorityContract
    ) {
      return { ok: false, value: 100 };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxLoanDuration(newDuration: number): Result<boolean> {
    if (newDuration <= 0 || !this.state.authorityContract)
      return { ok: false, value: newDuration <= 0 ? 104 : 100 };
    this.state.maxLoanDuration = newDuration;
    return { ok: true, value: true };
  }

  setExtensionFee(newFee: number): Result<boolean> {
    if (newFee < 0 || !this.state.authorityContract)
      return { ok: false, value: newFee < 0 ? 110 : 100 };
    this.state.extensionFee = newFee;
    return { ok: true, value: true };
  }

  startLoan(
    nftId: number,
    borrower: string,
    duration: number,
    accessKey: Buffer,
    amountPaid: number
  ): Result<number> {
    if (this.caller !== this.libraryPrincipal) return { ok: false, value: 107 };
    if (duration <= 0 || duration > this.state.maxLoanDuration)
      return { ok: false, value: 104 };
    if (accessKey.length === 0) return { ok: false, value: 105 };
    if (amountPaid <= 0) return { ok: false, value: 110 };
    if (!this.textbookNFT.getOwner(nftId)) return { ok: false, value: 102 };
    const key = `${nftId}-${borrower}`;
    if (this.state.loans.has(key)) return { ok: false, value: 103 };
    if (!this.paymentGateway.processPayment(amountPaid, this.caller))
      return { ok: false, value: 111 };
    const loanId = this.state.loanCounter;
    this.state.loans.set(key, {
      startTime: this.blockHeight,
      duration,
      accessKey,
      extended: false,
      amountPaid,
    });
    this.state.loanHistory.set(
      key,
      [
        { timestamp: this.blockHeight, action: "start-loan", success: true },
        ...(this.state.loanHistory.get(key) || []),
      ].slice(0, 10)
    );
    this.state.loanCounter++;
    return { ok: true, value: loanId };
  }

  checkAccess(nftId: number, borrower: string): Result<Buffer | number> {
    const key = `${nftId}-${borrower}`;
    const loan = this.state.loans.get(key);
    if (!loan) return { ok: false, value: 106 };
    if (this.blockHeight > loan.startTime + loan.duration) {
      this.state.loanHistory.set(
        key,
        [
          {
            timestamp: this.blockHeight,
            action: "access-denied",
            success: false,
          },
          ...(this.state.loanHistory.get(key) || []),
        ].slice(0, 10)
      );
      return { ok: false, value: 101 };
    }
    return { ok: true, value: loan.accessKey };
  }

  endLoan(nftId: number, borrower: string): Result<boolean> {
    const key = `${nftId}-${borrower}`;
    const loan = this.state.loans.get(key);
    if (!loan) return { ok: false, value: 106 };
    if (
      this.caller !== this.libraryPrincipal &&
      this.blockHeight < loan.startTime + loan.duration
    )
      return { ok: false, value: 100 };
    this.state.loans.delete(key);
    this.state.loanHistory.set(
      key,
      [
        { timestamp: this.blockHeight, action: "end-loan", success: true },
        ...(this.state.loanHistory.get(key) || []),
      ].slice(0, 10)
    );
    return { ok: true, value: true };
  }

  extendLoan(
    nftId: number,
    borrower: string,
    additionalDuration: number
  ): Result<boolean> {
    const key = `${nftId}-${borrower}`;
    const loan = this.state.loans.get(key);
    if (!loan) return { ok: false, value: 106 };
    if (this.caller !== this.libraryPrincipal) return { ok: false, value: 107 };
    if (loan.extended) return { ok: false, value: 114 };
    if (
      additionalDuration <= 0 ||
      additionalDuration > this.state.maxLoanDuration
    )
      return { ok: false, value: 104 };
    if (this.blockHeight > loan.startTime + loan.duration)
      return { ok: false, value: 101 };
    if (
      !this.paymentGateway.processPayment(this.state.extensionFee, this.caller)
    )
      return { ok: false, value: 111 };
    this.state.loans.set(key, {
      ...loan,
      duration: loan.duration + additionalDuration,
      extended: true,
      amountPaid: loan.amountPaid + this.state.extensionFee,
    });
    this.state.loanHistory.set(
      key,
      [
        { timestamp: this.blockHeight, action: "extend-loan", success: true },
        ...(this.state.loanHistory.get(key) || []),
      ].slice(0, 10)
    );
    return { ok: true, value: true };
  }
}

describe("TimedAccess", () => {
  let contract: TimedAccessMock;

  beforeEach(() => {
    contract = new TimedAccessMock();
    contract.reset();
  });

  it("starts loan successfully", () => {
    contract.caller = contract.libraryPrincipal;
    const result = contract.startLoan(
      1,
      "ST2BORROWER",
      1440,
      Buffer.from("a".repeat(32)),
      500
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);
    const loan = contract.state.loans.get("1-ST2BORROWER");
    expect(loan).toEqual({
      startTime: 0,
      duration: 1440,
      accessKey: Buffer.from("a".repeat(32)),
      extended: false,
      amountPaid: 500,
    });
    expect(contract.state.loanHistory.get("1-ST2BORROWER")?.[0]).toEqual({
      timestamp: 0,
      action: "start-loan",
      success: true,
    });
    expect(contract.paymentGateway.processPayment).toHaveBeenCalledWith(
      500,
      contract.libraryPrincipal
    );
  });

  it("rejects unauthorized loan start", () => {
    contract.caller = "ST3FAKE";
    const result = contract.startLoan(
      1,
      "ST2BORROWER",
      1440,
      Buffer.from("a".repeat(32)),
      500
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(107);
  });

  it("rejects invalid duration", () => {
    contract.caller = contract.libraryPrincipal;
    const result = contract.startLoan(
      1,
      "ST2BORROWER",
      43201,
      Buffer.from("a".repeat(32)),
      500
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(104);
  });

  it("checks access successfully", () => {
    contract.caller = contract.libraryPrincipal;
    contract.startLoan(
      1,
      "ST2BORROWER",
      1440,
      Buffer.from("a".repeat(32)),
      500
    );
    const result = contract.checkAccess(1, "ST2BORROWER");
    expect(result.ok).toBe(true);
    expect(result.value).toEqual(Buffer.from("a".repeat(32)));
  });

  it("rejects access for expired loan", () => {
    contract.caller = contract.libraryPrincipal;
    contract.startLoan(
      1,
      "ST2BORROWER",
      1440,
      Buffer.from("a".repeat(32)),
      500
    );
    contract.blockHeight = 1441;
    const result = contract.checkAccess(1, "ST2BORROWER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(101);
    expect(contract.state.loanHistory.get("1-ST2BORROWER")?.[0]).toEqual({
      timestamp: 1441,
      action: "access-denied",
      success: false,
    });
  });

  it("ends loan successfully", () => {
    contract.caller = contract.libraryPrincipal;
    contract.startLoan(
      1,
      "ST2BORROWER",
      1440,
      Buffer.from("a".repeat(32)),
      500
    );
    const result = contract.endLoan(1, "ST2BORROWER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.loans.has("1-ST2BORROWER")).toBe(false);
    expect(contract.state.loanHistory.get("1-ST2BORROWER")?.[0]).toEqual({
      timestamp: 0,
      action: "end-loan",
      success: true,
    });
  });

  it("extends loan successfully", () => {
    contract.caller = contract.libraryPrincipal;
    contract.setAuthorityContract("ST2TEST");
    contract.startLoan(
      1,
      "ST2BORROWER",
      1440,
      Buffer.from("a".repeat(32)),
      500
    );
    const result = contract.extendLoan(1, "ST2BORROWER", 720);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const loan = contract.state.loans.get("1-ST2BORROWER");
    expect(loan?.duration).toBe(2160);
    expect(loan?.extended).toBe(true);
    expect(loan?.amountPaid).toBe(1500);
    expect(contract.state.loanHistory.get("1-ST2BORROWER")?.[0]).toEqual({
      timestamp: 0,
      action: "extend-loan",
      success: true,
    });
  });

  it("rejects extension for expired loan", () => {
    contract.caller = contract.libraryPrincipal;
    contract.setAuthorityContract("ST2TEST");
    contract.startLoan(
      1,
      "ST2BORROWER",
      1440,
      Buffer.from("a".repeat(32)),
      500
    );
    contract.blockHeight = 1441;
    const result = contract.extendLoan(1, "ST2BORROWER", 720);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(101);
  });
});
