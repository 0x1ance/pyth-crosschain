import React, { useEffect, useState } from "react";
import "./App.css";
import {
  EvmPriceServiceConnection,
  HexString,
  Price,
  PriceFeed,
} from "@pythnetwork/pyth-evm-js";
import { useMetaMask } from "metamask-react";
import Web3 from "web3";
import { BlockMeta, ChainState, ExchangeRateMeta, LiquidityInfo, tokenQtyToNumber } from "./utils";
import { OrderEntry } from "./OrderEntry";
import { PriceText } from "./PriceText";
import { MintButton } from "./MintButton";
import { getApprovedQuantity, getBalance } from "./erc20";
import { getLiquidityInfo } from "./swap";
import { BigNumber } from "ethers";
import LiquidityEntry from "./LiquidityEntry";
import clsx from "clsx";

const CONFIG = {
  // Each token is configured with its ERC20 contract address and Pyth Price Feed ID.
  // You can find the list of price feed ids at https://pyth.network/developers/price-feed-ids
  // Note that feeds have different ids on testnet / mainnet.
  baseToken: {
    name: "BRL",
    erc20Address: "0xB3a2EDFEFC35afE110F983E32Eb67E671501de1f",
    pythPriceFeedId:
      "08f781a893bc9340140c5f89c8a96f438bcfae4d1474cc0f688e3a52892c7318",
    decimals: 18,
  },
  quoteToken: {
    name: "USD",
    erc20Address: "0x8C65F3b18fB29D756d26c1965d84DBC273487624",
    pythPriceFeedId:
      "1fc18861232290221461220bd4e2acd1dcdfbc89c84092c93c18bdc7756c1588",
    decimals: 18,
  },
  swapContractAddress: "0xCab2e8D01C17530F1dD83B1681AF3691560c876c",
  pythContractAddress: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  priceServiceUrl: "https://xc-testnet.pyth.network",
  mintQty: 100,
};

function App() {
  const { status, connect, account, ethereum } = useMetaMask();

  const [web3, setWeb3] = useState<Web3 | undefined>(undefined);

  useEffect(() => {
    if (status === "connected") {
      setWeb3(new Web3(ethereum));
    }
  }, [status, ethereum]);

  const [chainState, setChainState] = useState<ChainState | undefined>(
    undefined
  );
  const [liquidityInfo, setLiquidtyInfo] = useState<LiquidityInfo | undefined>(undefined);
  const [blockMeta, setBlockMeta] = useState<BlockMeta | undefined>(undefined)
  useEffect(() => {
    async function refreshChainState() {
      if (web3 !== undefined && account !== null) {
        setChainState({
          accountBaseBalance: await getBalance(
            web3,
            CONFIG.baseToken.erc20Address,
            account
          ),
          accountQuoteBalance: await getBalance(
            web3,
            CONFIG.quoteToken.erc20Address,
            account
          ),
          poolBaseBalance: await getBalance(
            web3,
            CONFIG.baseToken.erc20Address,
            CONFIG.swapContractAddress
          ),
          poolQuoteBalance: await getBalance(
            web3,
            CONFIG.quoteToken.erc20Address,
            CONFIG.swapContractAddress
          ),
        });
        setLiquidtyInfo(await getLiquidityInfo(web3, CONFIG.swapContractAddress, account))
        setBlockMeta({ currentBlockNum: await web3.eth.getBlockNumber(), lastUpdatedTime: new Date() });
      } else {
        setChainState(undefined);
        setLiquidtyInfo(undefined)
      }
    }

    const interval = setInterval(refreshChainState, 3000);

    return () => {
      clearInterval(interval);
    };
  }, [web3, account]);

  const [pythOffChainPrice, setPythOffChainPrice] = useState<
    Record<HexString, Price>
  >({});

  // Subscribe to offchain prices. These are the prices that a typical frontend will want to show.
  useEffect(() => {
    // The Pyth price service client is used to retrieve the current Pyth prices and the price update data that
    // needs to be posted on-chain with each transaction.
    const pythPriceService = new EvmPriceServiceConnection(
      CONFIG.priceServiceUrl,
      {
        logger: {
          error: console.error,
          warn: console.warn,
          info: () => undefined,
          debug: () => undefined,
          trace: () => undefined,
        },
      }
    );

    pythPriceService.subscribePriceFeedUpdates(
      [CONFIG.baseToken.pythPriceFeedId, CONFIG.quoteToken.pythPriceFeedId],
      (priceFeed: PriceFeed) => {
        const price = priceFeed.getPriceUnchecked(); // Fine to use unchecked (not checking for staleness) because this must be a recent price given that it comes from a websocket subscription.
        setPythOffChainPrice((prev) => ({ ...prev, [priceFeed.id]: price }));
      }
    );
  }, []);

  const [exchangeRateMeta, setExchangeRateMeta] = useState<
    ExchangeRateMeta | undefined
  >(undefined);

  useEffect(() => {
    let basePrice = pythOffChainPrice[CONFIG.baseToken.pythPriceFeedId];
    let quotePrice = pythOffChainPrice[CONFIG.quoteToken.pythPriceFeedId];

    if (basePrice !== undefined && quotePrice !== undefined) {
      const exchangeRate =
        basePrice.getPriceAsNumberUnchecked() /
        quotePrice.getPriceAsNumberUnchecked();
      const lastUpdatedTime = new Date(
        Math.max(basePrice.publishTime, quotePrice.publishTime) * 1000
      );
      setExchangeRateMeta({ rate: exchangeRate, lastUpdatedTime });
    } else {
      setExchangeRateMeta(undefined);
    }
  }, [pythOffChainPrice]);

  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const [isBuy, setIsBuy] = useState<boolean>(true);

  return (
    <div className="App">
      <div className="control-panel">
        <h3>Control Panel</h3>

        <div>
          {status === "connected" ? (
            <label>
              Connected Wallet: <br /> {account}
            </label>
          ) : (
            <button
              onClick={async () => {
                connect();
              }}
            >
              {" "}
              Connect Wallet{" "}
            </button>
          )}
        </div>
        <div>

        </div>

        <div>
          <h3>Wallet Balances</h3>
          {chainState !== undefined ? (
            <div>
              <p>
                {tokenQtyToNumber(
                  chainState.accountBaseBalance,
                  CONFIG.baseToken.decimals
                )}{" "}
                {CONFIG.baseToken.name}
                <MintButton
                  web3={web3!}
                  sender={account!}
                  erc20Address={CONFIG.baseToken.erc20Address}
                  destination={account!}
                  qty={CONFIG.mintQty}
                  decimals={CONFIG.baseToken.decimals}
                />
              </p>
              <p>
                {tokenQtyToNumber(
                  chainState.accountQuoteBalance,
                  CONFIG.quoteToken.decimals
                )}{" "}
                {CONFIG.quoteToken.name}
                <MintButton
                  web3={web3!}
                  sender={account!}
                  erc20Address={CONFIG.quoteToken.erc20Address}
                  destination={account!}
                  qty={CONFIG.mintQty}
                  decimals={CONFIG.quoteToken.decimals}
                />
              </p>
            </div>
          ) : (
            <p>loading...</p>
          )}
        </div>

        <h3>AMM Balances</h3>
        <div>
          <p>Contract address: {CONFIG.swapContractAddress}</p>
          {chainState !== undefined ? (
            <div>
              <p>
                {tokenQtyToNumber(
                  chainState.poolBaseBalance,
                  CONFIG.baseToken.decimals
                )}{" "}
                {CONFIG.baseToken.name}
                <MintButton
                  web3={web3!}
                  sender={account!}
                  erc20Address={CONFIG.baseToken.erc20Address}
                  destination={CONFIG.swapContractAddress}
                  qty={CONFIG.mintQty}
                  decimals={CONFIG.baseToken.decimals}
                />
              </p>
              <p>
                {tokenQtyToNumber(
                  chainState.poolQuoteBalance,
                  CONFIG.quoteToken.decimals
                )}{" "}
                {CONFIG.quoteToken.name}
                <MintButton
                  web3={web3!}
                  sender={account!}
                  erc20Address={CONFIG.quoteToken.erc20Address}
                  destination={CONFIG.swapContractAddress}
                  qty={CONFIG.mintQty}
                  decimals={CONFIG.quoteToken.decimals}
                />
              </p>
            </div>
          ) : (
            <p>loading...</p>
          )}
        </div>

        {
          liquidityInfo ?
            <>
              <div className='mt-4 w-full rounded-xl border border-white p-3'>
                <div className="font-extrabold underline">AMM Liquidity Info</div>
                <div className='mt-2 grid grid-cols-2'>
                  <div>SwapFeeBasisPoints: {
                    liquidityInfo.swapFeeBasisPoints
                  }</div>
                  <div>ClaimInterval: {
                    liquidityInfo.claimInterval
                  }{' '} blocks</div>
                  <div>Total BRL liquidity: {tokenQtyToNumber(
                    liquidityInfo.totalBaseLiquidity,
                    CONFIG.baseToken.decimals
                  )}</div>
                  <div>Total USD liquidity: {tokenQtyToNumber(
                    liquidityInfo.totalQuoteLiquidity,
                    CONFIG.quoteToken.decimals
                  )}</div>
                  <div>Total BRL fees: {tokenQtyToNumber(
                    liquidityInfo.totalBaseFees,
                    CONFIG.baseToken.decimals
                  )}</div>
                  <div>Total USD fees: {tokenQtyToNumber(
                    liquidityInfo.totalQuoteFees,
                    CONFIG.quoteToken.decimals
                  )}</div>
                </div>
              </div>
              <div className='mt-4 w-full rounded-xl border border-white p-3'>
                <div className="font-extrabold underline">User Liquidity Info</div>
                <div className='mt-2 grid grid-cols-2'>
                  <div>BRL liquidity: {tokenQtyToNumber(
                    liquidityInfo.baseAmt,
                    CONFIG.baseToken.decimals
                  )}</div>
                  <div>USD token liquidity: {tokenQtyToNumber(
                    liquidityInfo.quoteAmt,
                    CONFIG.quoteToken.decimals
                  )}</div>
                  <div>Last claim block number: {liquidityInfo.lastClaimBlockNum}</div>
                  <div>Last update block number: {liquidityInfo.lastUpdateBlockNum}</div>
                </div>
              </div>
            </>

            : <></>
        }

      </div>

      <div className={clsx("main",'h-[100vh] overflow-y-scroll py-10')}>
        <h3>
          Swap between {CONFIG.baseToken.name} and {CONFIG.quoteToken.name}
        </h3>
        <PriceText
          price={pythOffChainPrice}
          currentTime={time}
          rate={exchangeRateMeta}
          baseToken={CONFIG.baseToken}
          quoteToken={CONFIG.quoteToken}
        />
        <div className="tab-header">
          <div
            className={`tab-item ${isBuy ? "active" : ""}`}
            onClick={() => setIsBuy(true)}
          >
            Buy
          </div>
          <div
            className={`tab-item ${!isBuy ? "active" : ""}`}
            onClick={() => setIsBuy(false)}
          >
            Sell
          </div>
        </div>
        <div className="tab-content">
          <OrderEntry
            web3={web3}
            account={account}
            isBuy={isBuy}
            approxPrice={exchangeRateMeta?.rate}
            baseToken={CONFIG.baseToken}
            quoteToken={CONFIG.quoteToken}
            priceServiceUrl={CONFIG.priceServiceUrl}
            pythContractAddress={CONFIG.pythContractAddress}
            swapContractAddress={CONFIG.swapContractAddress}
          />
        </div>

        <div className='mt-8'>
          {
            blockMeta && liquidityInfo ? web3 && account ?
              <LiquidityEntry web3={web3} account={account} blockMeta={blockMeta} liquidityInfo={liquidityInfo} baseToken={CONFIG.baseToken} quoteToken={CONFIG.quoteToken} swapContractAddress={CONFIG.swapContractAddress} />
              : <div>Connect your wallet to provide liquidity</div>
              : 'loading...'
          }
        </div>
      </div>
    </div>
  );
}

export default App;
