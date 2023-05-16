
import Web3 from "web3";
import OracleSwapAbi from "./abi/OracleSwapAbi.json";
import { BigNumber } from "ethers";
import { LiquidityInfo } from "./utils";

export async function getLiquidityInfo(
    web3: Web3,
    swapContractAddress: string,
    address: string
): Promise<LiquidityInfo> {
    const swapContract = new web3.eth.Contract(
        OracleSwapAbi as any,
        swapContractAddress
    );

    const res = (await swapContract.methods
        .liquidityBalance(address)
        .call()) as {
            baseAmt: BigNumber;
            quoteAmt: BigNumber;
            lastUpdateBlockNum: BigNumber;
            lastClaimBlockNum: BigNumber;
        }

    return {
        baseAmt: BigNumber.from(res.baseAmt),
        quoteAmt: BigNumber.from(res.quoteAmt),
        lastUpdateBlockNum: BigNumber.from(res.lastUpdateBlockNum).toNumber(),
        lastClaimBlockNum: BigNumber.from(res.lastClaimBlockNum).toNumber(),
        totalBaseLiquidity: BigNumber.from(await swapContract.methods.totalBaseLiquidity().call()),
        totalQuoteLiquidity: BigNumber.from(await swapContract.methods.totalQuoteLiquidity().call()),
        swapFeeBasisPoints: BigNumber.from(await swapContract.methods.swapFeeBasisPoints().call()).toNumber(),
        totalBaseFees: BigNumber.from(await swapContract.methods.totalBaseFees().call()),
        totalQuoteFees: BigNumber.from(await swapContract.methods.totalQuoteFees().call()),
        claimInterval: BigNumber.from(await swapContract.methods.claimInterval().call()).toNumber(),
    };
}

export async function sendAddLiquidity(
    web3: Web3,
    sender: string,
    baseQtyWei: BigNumber,
    quoteQtyWei: BigNumber,
    swapContractAddress: string
) {

    const swapContract = new web3.eth.Contract(
        OracleSwapAbi as any,
        swapContractAddress
    );

    await swapContract.methods
        .addLiquidity(baseQtyWei, quoteQtyWei)
        .send({ from: sender });
}

export async function sendRemoveLiquidity(
    web3: Web3,
    sender: string,
    baseQtyWei: BigNumber,
    quoteQtyWei: BigNumber,
    swapContractAddress: string
) {

    const swapContract = new web3.eth.Contract(
        OracleSwapAbi as any,
        swapContractAddress
    );

    await swapContract.methods
        .removeLiquidity(baseQtyWei, quoteQtyWei)
        .send({ from: sender });
}

export async function sendClaimFees(
    web3: Web3,
    sender: string,
    swapContractAddress: string
) {

    const swapContract = new web3.eth.Contract(
        OracleSwapAbi as any,
        swapContractAddress
    );

    await swapContract.methods
        .claimFees()
        .send({ from: sender });
}
