(define-constant ERR_NOT_AUTHORIZED u100)
(define-constant ERR_LOAN_EXPIRED u101)
(define-constant ERR_INVALID_NFT u102)
(define-constant ERR_ALREADY_BORROWED u103)
(define-constant ERR_INVALID_DURATION u104)
(define-constant ERR_INVALID_KEY u105)
(define-constant ERR_LOAN_NOT_FOUND u106)
(define-constant ERR_NOT_LIBRARY u107)
(define-constant ERR_INVALID_TIMESTAMP u108)
(define-constant ERR_ACCESS_DENIED u109)
(define-constant ERR_INVALID_AMOUNT u110)
(define-constant ERR_PAYMENT_FAILED u111)
(define-constant ERR_EXTENSION_NOT_ALLOWED u112)
(define-constant ERR_INVALID_EXTENSION u113)
(define-constant ERR_ALREADY_EXTENDED u114)

(define-data-var loan-counter uint u0)
(define-data-var max-loan-duration uint u43200)
(define-data-var extension-fee uint u1000)
(define-data-var authority-contract (optional principal) none)

(define-map Loans
  { nft-id: uint, borrower: principal }
  { start-time: uint, duration: uint, access-key: (buff 32), extended: bool, amount-paid: uint }
)

(define-map LoanHistory
  { nft-id: uint, borrower: principal }
  (list 10 { timestamp: uint, action: (string-utf8 20), success: bool })
)

(define-read-only (get-loan (nft-id uint) (borrower principal))
  (map-get? Loans { nft-id: nft-id, borrower: borrower })
)

(define-read-only (get-loan-history (nft-id uint) (borrower principal))
  (map-get? LoanHistory { nft-id: nft-id, borrower: borrower })
)

(define-read-only (get-loan-counter)
  (ok (var-get loan-counter))
)

(define-private (validate-duration (duration uint))
  (if (and (> duration u0) (<= duration (var-get max-loan-duration)))
    (ok true)
    (err ERR_INVALID_DURATION))
)

(define-private (validate-key (key (buff 32)))
  (if (> (len key) u0)
    (ok true)
    (err ERR_INVALID_KEY))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR_INVALID_TIMESTAMP))
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
    (ok true)
    (err ERR_INVALID_AMOUNT))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (asserts! (not (is-eq contract-principal 'SP000000000000000000002Q6VF78)) ERR_NOT_AUTHORIZED)
    (asserts! (is-none (var-get authority-contract)) ERR_NOT_AUTHORIZED)
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-loan-duration (new-duration uint))
  (begin
    (asserts! (> new-duration u0) ERR_INVALID_DURATION)
    (asserts! (is-some (var-get authority-contract)) ERR_NOT_AUTHORIZED)
    (var-set max-loan-duration new-duration)
    (ok true)
  )
)

(define-public (set-extension-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) ERR_INVALID_AMOUNT)
    (asserts! (is-some (var-get authority-contract)) ERR_NOT_AUTHORIZED)
    (var-set extension-fee new-fee)
    (ok true)
  )
)

(define-public (start-loan (nft-id uint) (borrower principal) (duration uint) (access-key (buff 32)) (amount-paid uint))
  (let
    (
      (current-time block-height)
      (loan-id (var-get loan-counter))
      (library (contract-call? .LibraryInventory get-library-principal))
    )
    (asserts! (is-eq tx-sender library) ERR_NOT_LIBRARY)
    (try! (validate-duration duration))
    (try! (validate-key access-key))
    (try! (validate-amount amount-paid))
    (asserts! (is-some (contract-call? .TextbookNFT get-owner nft-id)) ERR_INVALID_NFT)
    (asserts! (is-none (map-get? Loans { nft-id: nft-id, borrower: borrower })) ERR_ALREADY_BORROWED)
    (try! (contract-call? .PaymentGateway process-payment amount-paid tx-sender))
    (map-set Loans
      { nft-id: nft-id, borrower: borrower }
      { start-time: current-time, duration: duration, access-key: access-key, extended: false, amount-paid: amount-paid }
    )
    (map-set LoanHistory
      { nft-id: nft-id, borrower: borrower }
      (cons { timestamp: current-time, action: u"start-loan", success: true }
        (default-to (list) (map-get? LoanHistory { nft-id: nft-id, borrower: borrower })))
    )
    (var-set loan-counter (+ loan-id u1))
    (print { event: "loan-started", nft-id: nft-id, borrower: borrower, loan-id: loan-id })
    (ok loan-id)
  )
)

(define-public (check-access (nft-id uint) (borrower principal))
  (match (map-get? Loans { nft-id: nft-id, borrower: borrower })
    loan
      (let
        (
          (current-time block-height)
          (end-time (+ (get start-time loan) (get duration loan)))
        )
        (if (<= current-time end-time)
          (ok (get access-key loan))
          (begin
            (map-set LoanHistory
              { nft-id: nft-id, borrower: borrower }
              (cons { timestamp: current-time, action: u"access-denied", success: false }
                (default-to (list) (map-get? LoanHistory { nft-id: nft-id, borrower: borrower })))
            )
            ERR_LOAN_EXPIRED
          )
        )
      )
    ERR_LOAN_NOT_FOUND
  )
)

(define-public (end-loan (nft-id uint) (borrower principal))
  (let
    (
      (current-time block-height)
      (loan (unwrap! (map-get? Loans { nft-id: nft-id, borrower: borrower }) ERR_LOAN_NOT_FOUND))
      (library (contract-call? .LibraryInventory get-library-principal))
    )
    (asserts! (or (is-eq tx-sender library) (>= current-time (+ (get start-time loan) (get duration loan)))) ERR_NOT_AUTHORIZED)
    (map-delete Loans { nft-id: nft-id, borrower: borrower })
    (map-set LoanHistory
      { nft-id: nft-id, borrower: borrower }
      (cons { timestamp: current-time, action: u"end-loan", success: true }
        (default-to (list) (map-get? LoanHistory { nft-id: nft-id, borrower: borrower })))
    )
    (print { event: "loan-ended", nft-id: nft-id, borrower: borrower })
    (ok true)
  )
)

(define-public (extend-loan (nft-id uint) (borrower principal) (additional-duration uint))
  (let
    (
      (current-time block-height)
      (loan (unwrap! (map-get? Loans { nft-id: nft-id, borrower: borrower }) ERR_LOAN_NOT_FOUND))
      (library (contract-call? .LibraryInventory get-library-principal))
    )
    (asserts! (is-eq tx-sender library) ERR_NOT_LIBRARY)
    (asserts! (not (get extended loan)) ERR_ALREADY_EXTENDED)
    (try! (validate-duration additional-duration))
    (asserts! (<= current-time (+ (get start-time loan) (get duration loan))) ERR_LOAN_EXPIRED)
    (try! (contract-call? .PaymentGateway process-payment (var-get extension-fee) tx-sender))
    (map-set Loans
      { nft-id: nft-id, borrower: borrower }
      {
        start-time: (get start-time loan),
        duration: (+ (get duration loan) additional-duration),
        access-key: (get access-key loan),
        extended: true,
        amount-paid: (+ (get amount-paid loan) (var-get extension-fee))
      }
    )
    (map-set LoanHistory
      { nft-id: nft-id, borrower: borrower }
      (cons { timestamp: current-time, action: u"extend-loan", success: true }
        (default-to (list) (map-get? LoanHistory { nft-id: nft-id, borrower: borrower })))
    )
    (print { event: "loan-extended", nft-id: nft-id, borrower: borrower, new-duration: (+ (get duration loan) additional-duration) })
    (ok true)
  )
)