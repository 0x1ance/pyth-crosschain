import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import '@typechain/hardhat'

const config: HardhatUserConfig = {
  solidity: "0.8.0",
  networks: {
    hardhat: {
      forking: {
        url: 'https://endpoints.omniatech.io/v1/matic/mumbai/public'
      }
    }
  },
  typechain: {
    outDir: './typechain-types',
    target: 'ethers-v5',
    alwaysGenerateOverloads: false,
    externalArtifacts: ['externalArtifacts/*.json'],
    dontOverrideCompile: false,
  },
  paths: {
    sources: './src',
    tests: './__test__/specs',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
