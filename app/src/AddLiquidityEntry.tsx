import React, { FC, useEffect, useState } from 'react'
import Web3 from 'web3';
import { BlockMeta, LiquidityInfo, TokenConfig, numberToTokenQty } from './utils';
import { BigNumber } from 'ethers';
import clsx from 'clsx';
import { approveToken } from './erc20';
import { sendAddLiquidity } from './swap';

const AddLiquidityEntry: FC<{
    web3: Web3;
    account: string;
    blockMeta: BlockMeta,
    liquidityInfo: LiquidityInfo
    baseToken: TokenConfig;
    quoteToken: TokenConfig;
    swapContractAddress: string;
    authorizedQty: {
        base: BigNumber;
        quote: BigNumber;
    }
}> = ({
    web3, account, blockMeta, liquidityInfo, baseToken, quoteToken, swapContractAddress, authorizedQty
}) => {

        const [baseQty, setBaseQty] = useState<string>("0");
        const [baseQtyBn, setBaseQtyBn] = useState<BigNumber>(
            BigNumber.from("0")
        );
        const [quoteQty, setQuoteQty] = useState<string>("0");
        const [quoteQtyBn, setQuoteQtyBn] = useState<BigNumber>(
            BigNumber.from("0")
        );
        const [isAuthorized, setIsAuthorized] = useState<{ base: boolean, quote: boolean }>({ base: false, quote: false });

        useEffect(() => {
            try {
                const qtyBn = numberToTokenQty(baseQty, baseToken.decimals);
                setBaseQtyBn(qtyBn);
            } catch (error) {
                setBaseQtyBn(BigNumber.from("0"));
            }
        }, [baseQty, baseToken.decimals]);

        useEffect(() => {
            try {
                const qtyBn = numberToTokenQty(quoteQty, quoteToken.decimals);
                setQuoteQtyBn(qtyBn);
            } catch (error) {
                setQuoteQtyBn(BigNumber.from("0"));
            }
        }, [quoteQty, quoteToken.decimals]);


        useEffect(() => {
            setIsAuthorized({ base: baseQtyBn ? authorizedQty.base.gte(baseQtyBn) : false, quote: quoteQtyBn ? authorizedQty.quote.gte(quoteQtyBn) : false })
        }, [baseQtyBn, quoteQtyBn, authorizedQty]);


        return (
            <div className='mt-4'>
                <div className='font-bold'>Add Liquidity</div>
                <div className='grid grid-cols-1'>
                    <div>
                        add
                        <input
                            type="text"
                            name="base"
                            className='shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                            value={baseQty}
                            onChange={(event) => {
                                setBaseQty(event.target.value);
                            }}
                        />
                        {baseToken.name}{' '}
                    </div>
                    <div>
                        add
                        <input
                            className='shadow appearance-none border rounded py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline'
                            type="text"
                            name="quote"
                            value={quoteQty}
                            onChange={(event) => {
                                setQuoteQty(event.target.value);
                            }}
                        />
                        {quoteToken.name}{' '}
                    </div>
                    <div>
                        1.{" "}
                        <button
                            className={clsx(isAuthorized.base ? "bg-blue-500 text-white font-bold py-2 px-4 rounded opacity-20 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded")}
                            onClick={async () => {
                                await approveToken(
                                    web3!,
                                    baseToken.erc20Address,
                                    account!,
                                    swapContractAddress
                                );
                            }}
                            disabled={isAuthorized.base}
                        >
                            {" "}
                            Approve{" "}{baseToken.name}{" "}
                        </button>
                        <button
                            className={clsx(isAuthorized.quote ? "bg-blue-500 text-white font-bold py-2 px-4 rounded opacity-20 cursor-not-allowed" : "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded")}
                            onClick={async () => {
                                await approveToken(
                                    web3!,
                                    quoteToken.erc20Address,
                                    account!,
                                    swapContractAddress
                                );
                            }}
                            disabled={isAuthorized.quote}
                        >
                            {" "}
                            Approve{" "}{quoteToken.name}{" "}
                        </button>
                        2.
                        <button
                            className={clsx(isAuthorized.base && isAuthorized.quote ? "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" : "bg-blue-500 text-white font-bold py-2 px-4 rounded opacity-20 cursor-not-allowed")}
                            onClick={async () => {
                                await sendAddLiquidity(
                                    web3,
                                    account,
                                    baseQtyBn,
                                    quoteQtyBn,
                                    swapContractAddress,
                                );
                                setBaseQty("0");
                                setQuoteQty('0')
                            }}
                            disabled={!isAuthorized.base || !isAuthorized.quote}
                        >
                            {" "}
                            Add{" "}
                        </button>
                    </div>
                </div>
            </div>

        )
    }

export default AddLiquidityEntry