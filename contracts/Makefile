.PHONY: install build test fmt lint gas coverage storage clean

install:
	forge install foundry-rs/forge-std --no-git
	forge install OpenZeppelin/openzeppelin-contracts --no-git
	forge install OpenZeppelin/openzeppelin-contracts-upgradeable --no-git

build:   ; forge build
test:    ; forge test -vvv
fmt:     ; forge fmt
gas:     ; forge test --gas-report
coverage:; forge coverage --report summary

## SPEC-BC-0001 §9 — UUPS brick koruması
storage:
	@bash script/check-upgrade-safety.sh

clean:   ; forge clean
