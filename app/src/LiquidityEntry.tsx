import React, { FC, useEffect, useState } from 'react'
import { BlockMeta, LiquidityInfo, TokenConfig, tokenQtyToNumber } from './utils'
import Web3 from 'web3';
import { BigNumber } from 'ethers';
import { getApprovedQuantity } from './erc20';
import AddLiquidityEntry from './AddLiquidityEntry';
import RemoveLiquidityEntry from './removeLiquidityEntry';
import clsx from 'clsx';
import { sendClaimFees } from './swap';

const LiquidityEntry: FC<{
    web3: Web3;
    account: string;
    blockMeta: BlockMeta,
    liquidityInfo: LiquidityInfo
    baseToken: TokenConfig;
    quoteToken: TokenConfig;
    swapContractAddress: string;
}> = ({ web3, account, blockMeta, liquidityInfo, baseToken, quoteToken, swapContractAddress }) => {

    const [authorizedQty, setAuthorizedQty] = useState<{ base: BigNumber, quote: BigNumber }>(
        { base: BigNumber.from("0"), quote: BigNumber.from("0") }
    );

    useEffect(() => {
        async function refreshChainState() {
            if (web3 !== undefined && account !== null) {

                setAuthorizedQty({
                    base: await getApprovedQuantity(
                        web3,
                        baseToken.erc20Address,
                        account,
                        swapContractAddress
                    ),
                    quote: await getApprovedQuantity(
                        web3,
                        quoteToken.erc20Address,
                        account,
                        swapContractAddress
                    )
                }
                );
            } else {
                setAuthorizedQty({ base: BigNumber.from("0"), quote: BigNumber.from("0") })
            }
        }

        const interval = setInterval(refreshChainState, 3000);

        return () => {
            clearInterval(interval);
        };
    }, [web3, account]);

    const userToTotalBaseLiquidityRatio = liquidityInfo.totalBaseLiquidity.gt(0) ? Number(liquidityInfo.baseAmt.div(liquidityInfo.totalBaseLiquidity).toNumber().toFixed(3)) : 0
    const userToTotalQuoteLiquidityRatio = liquidityInfo.totalQuoteLiquidity.gt(0) ? Number(liquidityInfo.quoteAmt.div(liquidityInfo.totalQuoteLiquidity).toNumber().toFixed(3)) : 0

    const anchorBlockNum = liquidityInfo.lastUpdateBlockNum > liquidityInfo.lastClaimBlockNum ? liquidityInfo.lastUpdateBlockNum : liquidityInfo.lastClaimBlockNum
    const claimable = (blockMeta.currentBlockNum >= anchorBlockNum + liquidityInfo.claimInterval) && (userToTotalBaseLiquidityRatio > 0 || userToTotalQuoteLiquidityRatio > 0)
    return (
        <div>
            <div>Provide Liquidity</div>

            <div className='mt-2 w-full rounded-xl border border-black p-2'>
                <div className='grid grid-cols-2'>
                    <div>{baseToken.name} liquidity: {tokenQtyToNumber(liquidityInfo.baseAmt,
                        baseToken.decimals
                    )}</div>
                    <div>{quoteToken.name} liquidity: {tokenQtyToNumber(liquidityInfo.quoteAmt,
                        quoteToken.decimals
                    )}</div>
                </div>
                <AddLiquidityEntry web3={web3} account={account} blockMeta={blockMeta} liquidityInfo={liquidityInfo} baseToken={baseToken} quoteToken={quoteToken} swapContractAddress={swapContractAddress} authorizedQty={authorizedQty} />
                <div className='w-full border border-black my-2'></div>
                <RemoveLiquidityEntry web3={web3} account={account} liquidityInfo={liquidityInfo} baseToken={baseToken} quoteToken={quoteToken} swapContractAddress={swapContractAddress} />
            </div>

            <div className='my-8'>
                {
                    liquidityInfo.lastUpdateBlockNum
                        ? <div className='w-full p-2 border border-black rounded-xl'>
                            <div className='font-bold'>Earn Liquidity Reward</div>
                            <div className='grid grid-cols-2 my-1'>
                                <div>Current block: {blockMeta.currentBlockNum}</div>
                                <div> Next claim block: {blockMeta.currentBlockNum < anchorBlockNum + liquidityInfo.claimInterval ? anchorBlockNum + liquidityInfo.claimInterval : `${blockMeta.currentBlockNum} (Claimable)`}</div>
                            </div>
                            <div className='grid grid-cols-2 my-1'>
                                <div>Total BRL fees: {tokenQtyToNumber(
                                    liquidityInfo.totalBaseFees,
                                    baseToken.decimals
                                )}</div>
                                <div>Total USD fees: {tokenQtyToNumber(
                                    liquidityInfo.totalQuoteFees,
                                    quoteToken.decimals
                                )}</div>
                            </div>
                            <div className='grid grid-cols-2 my-4'>
                                {liquidityInfo.totalBaseLiquidity.gt(0) ? <div>Claimable BRL: {tokenQtyToNumber(
                                    liquidityInfo.totalBaseFees,
                                    baseToken.decimals
                                ) * userToTotalBaseLiquidityRatio}{' '}({(userToTotalBaseLiquidityRatio * 100).toFixed(0).toString() + '%'})</div> : <></>}
                                {liquidityInfo.totalQuoteLiquidity.gt(0) ? <div>Claimable USD: {tokenQtyToNumber(
                                    liquidityInfo.totalQuoteFees,
                                    quoteToken.decimals
                                )}{' '}({(userToTotalQuoteLiquidityRatio * 100).toFixed(0).toString() + '%'})</div> : <></>}

                            </div>
                            <button
                                className={clsx(claimable ? "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" : "bg-blue-500 text-white font-bold py-2 px-4 rounded opacity-20 cursor-not-allowed")}
                                onClick={async () => {
                                    await sendClaimFees(
                                        web3,
                                        account,
                                        swapContractAddress,
                                    );
                                }}
                                disabled={!claimable}
                            >
                                {" "}
                                Claim{" "}
                            </button>

                        </div>
                        : <></>
                }
            </div>


        </div>
    )
}

export default LiquidityEntry