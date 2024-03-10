const Web3 = require('web3');
const fs = require('fs')
const { runAddressValidity } = require('../attestation/attestRequester')

const abi = JSON.parse(fs.readFileSync('/Users/raul/_dev/HACKATHONS/OXFORD/main_repo/UniCross/CONTRACT_LISTNER/contract.json'));

let blockNumber = 5451903
const waitTime = 3 // seconds

const chainData = {
    11155111: {name:"Sepolia", exploreLink: 'https://sepolia.etherscan.io'} 
}

const runContractListner = async (ethContractAddress, flareContractAddress, ethRpcUrl, flareRpcUrl ) => {
  
    const ethWeb3 = new Web3(ethRpcUrl)
    // const contract = new ethWeb3.eth.Contract(abi, ethContractAddress)
    const chainId = await ethWeb3.eth.getChainId()
    console.log(`Contract Listner Started for contract ${ethContractAddress} on chain ${chainId}`)
    blockNumber = await ethWeb3.eth.getBlockNumber()

    while(true){
        console.log(`Checking block ${blockNumber}`)
        const getBlock = await ethWeb3.eth.getBlock(blockNumber)
        if(getBlock !== null){
            const txs = getBlock.transactions
            checkTransactions(txs, ethWeb3, ethContractAddress);
            blockNumber++
            console.log(`Waiting for ${waitTime} seconds`)
        } else {
            await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
        }
    }
}

async function checkTransactions (txs, ethWeb3, ethContractAddress) {
    const inputs = [
        {
            type: 'string',
            name: 'data'
        },

        {
            type: 'string',
            name: 'from'
        },
        {
            type: 'string',
            name: 'to'
        },
        {
            type: 'uint',
            name: 'amount'
        }
    ]

    for(let i = 0; i < txs.length; i++){
        const tx = await ethWeb3.eth.getTransaction(txs[i])
        if(tx.to === ethContractAddress){
            const txReceipt = await ethWeb3.eth.getTransactionReceipt(txs[i])
            txReceipt.logs.forEach(async (log) => {
                console.log('log decoded ', ethWeb3.eth.abi.decodeLog(inputs, log.data, log.topics));
                log.topics.forEach((topic, index) => {
                    console.log('topics ', ethWeb3.eth.abi.decodeParameter('uint', topic))
                });
                const proof = await runAddressValidity('eth', tx.hash);
                console.log("response body ", proof.data.responseBody);
                console.log("response body events", proof.data.responseBody.events[0]);
                console.log("sourceId ", proof.data.sourceId);
                console.log("proof ", proof.data.responseBody);
                console.log("merkle proof ", proof.data.merkleProof);
                const flareWeb3 = new Web3(flareRpcUrl);
                const flareContract = new flareWeb3.eth.Contract(abi, flareContractAddress);
                flareContract.FinalizeBridgeAndReleaseEth(proof);
            });
            console.log(`Transaction ${tx.hash} is sent to contract ${ethContractAddress}`)
            if(txReceipt.status){
            }else{
                console.log(`Transaction ${tx.hash} is failed`)
            }
        }
    }
}

module.exports = {
    runContractListner
}

