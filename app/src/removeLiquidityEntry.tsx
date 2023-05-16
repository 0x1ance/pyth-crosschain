import React, { FC, useEffect, useState } from 'react'
import Web3 from 'web3';
import { LiquidityInfo, TokenConfig, numberToTokenQty } from './utils';
import { BigNumber } from 'ethers';
import clsx from 'clsx';
import { sendRemoveLiquidity } from './swap';

const RemoveLiquidityEntry: FC<{
    web3: Web3;
    account: string;
    liquidityInfo: LiquidityInfo
    baseToken: TokenConfig;
    quoteToken: TokenConfig;
    swapContractAddress: string;
}> = ({
    web3, account, liquidityInfo, baseToken, quoteToken, swapContractAddress
}) => {

        const [baseQty, setBaseQty] = useState<string>("0");
        const [baseQtyBn, setBaseQtyBn] = useState<BigNumber>(
            BigNumber.from("0")
        );
        const [quoteQty, setQuoteQty] = useState<string>("0");
        const [quoteQtyBn, setQuoteQtyBn] = useState<BigNumber>(
            BigNumber.from("0")
        );
        const [isValidInput, setIsValidInput] = useState<boolean>(false);
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
            setIsValidInput((baseQtyBn.gte(BigNumber.from("0")) && baseQtyBn.lte(liquidityInfo.baseAmt)) || (quoteQtyBn.gte(BigNumber.from("0")) && quoteQtyBn.lte(liquidityInfo.quoteAmt)))
        }, [baseQtyBn, liquidityInfo.baseAmt, liquidityInfo.quoteAmt, quoteQtyBn]);
        return (
            <div>
                <div className='font-bold'>Withdraw Liquidity</div>
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
                        <button
                            className={clsx(isValidInput ? "bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" : "bg-blue-500 text-white font-bold py-2 px-4 rounded opacity-20 cursor-not-allowed")}
                            onClick={async () => {
                                await sendRemoveLiquidity(
                                    web3,
                                    account,
                                    baseQtyBn,
                                    quoteQtyBn,
                                    swapContractAddress,
                                );
                                setBaseQty("0");
                                setQuoteQty('0')
                            }}
                            disabled={!isValidInput}
                        >
                            {" "}
                            Withdraw{" "}
                        </button>
                    </div>
                </div>
            </div>

        )
    }

export default RemoveLiquidityEntry