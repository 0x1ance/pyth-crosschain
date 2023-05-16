## AMM Contract

Three functions has been added to the original OracleSwap contract:
- addLiquidity
- removeLiquidity
- claimFees
and updated the original function:
- swap

When user doing the swap, certain amount of fee will be charged (based on the swapFeeBasisPoints/10000 propotion), which will updated the attribute totalBaseFees/totalQuoteFees correspondingly as the pool of liquidity reward.

While user are able to add and withdraw liquidity through addLiquidity & removeLiquidity functions, whenever the liquidity is updated, the attribute lastUpdateBlockNum in the user liquidityBalance struct will be updated. Also will update the totalBaseLiquidity & totalQuoteLiquidity correspondingly.

The user can claim the reward (proportional to current totalBaseFees & totalQuoteFees) once the Max{lastUpdateBlockNum,lastClaimBlockNum} + claimInterval is less than currentBlockNum, based on the current user liquidity to the total AMM liquidity of each token. Which incentivise user to provide more liquidity when the total fee pool is large, and stay when the liquidity pool size shrink (increase the reward proportion to the total reward pool)

### Building

You need to have [Foundry](https://getfoundry.sh/) and `node` installed to run this example.
Once you have installed these tools, run the following commands from the [`contract`](./contract) directory:

```
forge install foundry-rs/forge-std@2c7cbfc6fbede6d7c9e6b17afe997e3fdfe22fef --no-git --no-commit
forge install pyth-network/pyth-sdk-solidity@v2.2.0 --no-git --no-commit
forge install OpenZeppelin/openzeppelin-contracts@v4.8.1 --no-git --no-commit
```

### Testing

Few test cases has been added to the OracleSwap.t.sol, including:
- testAddLiquidity
- testRemoveLiquidity
Simply run `forge test` in the [`contract`](./contract) directory. This command will run the
tests located in the [`contract/test`](./contract/test) directory.

### Create ABI

If you change the contract, you will need to create a new ABI.
The frontend uses this ABI to create transactions.
You can overwrite the existing ABI by running the following command:

```
forge inspect OracleSwap abi > ../app/src/abi/OracleSwapAbi.json
```

## Frontend Application

All of the commands in this section assume you are in the `app` directory.

By default, the frontend has been configured to the newly deployed version of the oracle AMM
at address [`0xCab2e8D01C17530F1dD83B1681AF3691560c876c`](https://mumbai.polygonscan.com/address/0xCab2e8D01C17530F1dD83B1681AF3691560c876c) on Polygon Mumbai.

### Build

`npm run build`

### Run

`npm run start`
