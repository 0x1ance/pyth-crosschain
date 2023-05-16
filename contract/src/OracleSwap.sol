// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import "pyth-sdk-solidity/IPyth.sol";
import "pyth-sdk-solidity/PythStructs.sol";
import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";
// import "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
// import "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

struct LiquidityRecord {
    uint256 baseAmt;
    uint256 quoteAmt;
    uint256 lastUpdateBlockNum;
    uint256 lastClaimBlockNum;
}

// Example oracle AMM powered by Pyth price feeds.
//
// The contract holds a pool of two ERC-20 tokens, the BASE and the QUOTE, and allows users to swap tokens
// for the pair BASE/QUOTE. For example, the base could be WETH and the quote could be USDC, in which case you can
// buy WETH for USDC and vice versa. The pool offers to swap between the tokens at the current Pyth exchange rate for
// BASE/QUOTE, which is computed from the BASE/USD price feed and the QUOTE/USD price feed.
//
// This contract only implements the swap functionality. It does not implement any pool balancing logic (e.g., skewing the
// price to reflect an unbalanced pool) or depositing / withdrawing funds. When deployed, the contract needs to be sent
// some quantity of both the base and quote token in order to function properly (using the ERC20 transfer function to
// the contract's address).
contract OracleSwap {
    event Transfer(address from, address to, uint amountUsd, uint amountWei);
    event AddLiquidity(address provider, uint baseAmt, uint quoteAmt);
    event RemoveLiquidity(address provider, uint baseAmt, uint quoteAmt);

    uint256 public totalBaseLiquidity; // total liquidity provided in base tokens
    uint256 public totalQuoteLiquidity; // total liquidity provided in quote tokens
    mapping(address => LiquidityRecord) public liquidityBalance; // liquidity provided by each user

    // Swap fee in basis points (i.e., over 10000)
    uint256 public swapFeeBasisPoints = 50;
    uint256 public totalBaseFees; // total fees collected in base tokens
    uint256 public totalQuoteFees; // total fees collected in quote tokens

    uint256 public claimInterval = 1000; // number of blocks between fee claims

    IPyth pyth;

    bytes32 baseTokenPriceId;
    bytes32 quoteTokenPriceId;

    ERC20 public baseToken;
    ERC20 public quoteToken;

    constructor(
        address _pyth,
        bytes32 _baseTokenPriceId,
        bytes32 _quoteTokenPriceId,
        address _baseToken,
        address _quoteToken
    ) {
        pyth = IPyth(_pyth);
        baseTokenPriceId = _baseTokenPriceId;
        quoteTokenPriceId = _quoteTokenPriceId;
        baseToken = ERC20(_baseToken);
        quoteToken = ERC20(_quoteToken);
    }

    // Buy or sell a quantity of the base token. `size` represents the quantity of the base token with the same number
    // of decimals as expected by its ERC-20 implementation. If `isBuy` is true, the contract will send the caller
    // `size` base tokens; if false, `size` base tokens will be transferred from the caller to the contract. Some
    // number of quote tokens will be transferred in the opposite direction; the exact number will be determined by
    // the current pyth price. The transaction will fail if either the pool or the sender does not have enough of the
    // requisite tokens for these transfers.
    //
    // `pythUpdateData` is the binary pyth price update data (retrieved from Pyth's price
    // service); this data should contain a price update for both the base and quote price feeds.
    // See the frontend code for an example of how to retrieve this data and pass it to this function.
    function swap(
        bool isBuy,
        uint size,
        bytes[] calldata pythUpdateData
    ) external payable {
        uint updateFee = pyth.getUpdateFee(pythUpdateData);
        pyth.updatePriceFeeds{value: updateFee}(pythUpdateData);

        PythStructs.Price memory currentBasePrice = pyth.getPrice(
            baseTokenPriceId
        );
        PythStructs.Price memory currentQuotePrice = pyth.getPrice(
            quoteTokenPriceId
        );

        // Note: this code does all arithmetic with 18 decimal points. This approach should be fine for most
        // price feeds, which typically have ~8 decimals. You can check the exponent on the price feed to ensure
        // this doesn't lose precision.
        uint256 basePrice = convertToUint(currentBasePrice, 18);
        uint256 quotePrice = convertToUint(currentQuotePrice, 18);

        // This computation loses precision. The infinite-precision result is between [quoteSize, quoteSize + 1]
        // We need to round this result in favor of the contract.
        uint256 quoteSize = (size * basePrice) / quotePrice;

        // TODO: use confidence interval

        if (isBuy) {
            // (Round up)
            quoteSize += 1;

            uint256 fee = (quoteSize * swapFeeBasisPoints) / 10000;
            quoteSize += fee;

            quoteToken.transferFrom(msg.sender, address(this), quoteSize);
            baseToken.transfer(msg.sender, size);
        } else {
            uint256 fee = (size * swapFeeBasisPoints) / 10000;
            size += fee;

            baseToken.transferFrom(msg.sender, address(this), size);
            quoteToken.transfer(msg.sender, quoteSize);
        }
    }

    // TODO: we should probably move something like this into the solidity sdk
    function convertToUint(
        PythStructs.Price memory price,
        uint8 targetDecimals
    ) private pure returns (uint256) {
        if (price.price < 0 || price.expo > 0 || price.expo < -255) {
            revert();
        }

        uint8 priceDecimals = uint8(uint32(-1 * price.expo));

        if (targetDecimals - priceDecimals >= 0) {
            return
                uint(uint64(price.price)) *
                10 ** uint32(targetDecimals - priceDecimals);
        } else {
            return
                uint(uint64(price.price)) /
                10 ** uint32(priceDecimals - targetDecimals);
        }
    }

    // allow user to add liquidity to the pool
    function addLiquidity(uint256 baseAmt, uint256 quoteAmt) external {
        require(baseAmt > 0 || quoteAmt > 0, "Invalid amount");

        LiquidityRecord storage record = liquidityBalance[msg.sender];

        record.lastUpdateBlockNum = block.number;

        if (baseAmt > 0) {
            totalBaseLiquidity += baseAmt;
            record.baseAmt += baseAmt;
            baseToken.transferFrom(msg.sender, address(this), baseAmt);
        }
        if (quoteAmt > 0) {
            totalQuoteLiquidity += quoteAmt;
            record.quoteAmt += quoteAmt;
            quoteToken.transferFrom(msg.sender, address(this), quoteAmt);
        }

        emit AddLiquidity(msg.sender, baseAmt, quoteAmt);
    }

    // allow user to remove liquidity from the pool
    function removeLiquidity(uint256 baseAmt, uint256 quoteAmt) external {
        LiquidityRecord storage record = liquidityBalance[msg.sender];

        require(
            (baseAmt > 0 || quoteAmt > 0) &&
                baseAmt <= record.baseAmt &&
                quoteAmt <= record.quoteAmt,
            "Invalid liquidity"
        );

        if (baseAmt > 0) {
            totalBaseLiquidity -= baseAmt;
            record.baseAmt -= baseAmt;

            baseToken.transfer(msg.sender, baseAmt);
        }
        if (quoteAmt > 0) {
            totalQuoteLiquidity -= quoteAmt;
            record.quoteAmt -= quoteAmt;
            quoteToken.transfer(msg.sender, quoteAmt);
        }

        emit RemoveLiquidity(msg.sender, baseAmt, quoteAmt);
    }

    // allow user to claim fees
    // design: user must wait a certain number of blocks between claims
    // after update to liquidity, user must wait a certain number of blocks before claiming too,
    // which incentivise user to provide more liquidity when the total fee pool is large
    // even when the liquidity pool size shrink, it incentivise user to stay inside the liquidity pool as the got higher proportion of the fee pool
    function claimFees() external {
        LiquidityRecord storage record = liquidityBalance[msg.sender];
        require(
            record.lastClaimBlockNum + claimInterval < block.number,
            "Too soon"
        );

        uint256 baseClaim = (totalBaseFees * record.baseAmt) /
            totalBaseLiquidity;

        uint256 quoteClaim = (totalQuoteFees * record.quoteAmt) /
            totalQuoteLiquidity;

        record.lastClaimBlockNum = block.number;

        baseToken.transfer(msg.sender, baseClaim);
        quoteToken.transfer(msg.sender, quoteClaim);
    }

    // Get the number of base tokens in the pool
    function baseBalance() public view returns (uint256) {
        return baseToken.balanceOf(address(this));
    }

    // Get the number of quote tokens in the pool
    function quoteBalance() public view returns (uint256) {
        return quoteToken.balanceOf(address(this));
    }

    // Send all tokens in the oracle AMM pool to the caller of this method.
    // (This function is for demo purposes only. You wouldn't include this on a real contract.)
    function withdrawAll() external {
        baseToken.transfer(msg.sender, baseToken.balanceOf(address(this)));
        quoteToken.transfer(msg.sender, quoteToken.balanceOf(address(this)));
    }

    // Reinitialize the parameters of this contract.
    // (This function is for demo purposes only. You wouldn't include this on a real contract.)
    function reinitialize(
        bytes32 _baseTokenPriceId,
        bytes32 _quoteTokenPriceId,
        address _baseToken,
        address _quoteToken
    ) external {
        baseTokenPriceId = _baseTokenPriceId;
        quoteTokenPriceId = _quoteTokenPriceId;
        baseToken = ERC20(_baseToken);
        quoteToken = ERC20(_quoteToken);
    }

    receive() external payable {}
}
