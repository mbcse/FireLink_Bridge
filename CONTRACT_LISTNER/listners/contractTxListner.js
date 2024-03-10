const Web3 = require('web3');
const fs = require('fs')

const abi = JSON.parse(fs.readFileSync('/Users/raul/_dev/HACKATHONS/OXFORD/main_repo/UniCross/CONTRACT_LISTNER/contract.json'));

let blockNumber = 5451903
const waitTime = 3 // seconds

const chainData = {
    11155111: {name:"Sepolia", exploreLink: 'https://sepolia.etherscan.io'} 
}

const runContractListner = async (contractAddress, rpcUrl) => {
  
    const web3 = new Web3(rpcUrl)
    const contract = new web3.eth.Contract(abi, contractAddress)
    const chainId = await web3.eth.getChainId()
    console.log(`Contract Listner Started for contract ${contractAddress} on chain ${chainId}`)
    blockNumber = await web3.eth.getBlockNumber()

    while(true){
        console.log(`Checking block ${blockNumber}`)
        const getBlock = await web3.eth.getBlock(blockNumber)
        if(getBlock !== null){
            const txs = getBlock.transactions
            checkTransactions(txs, web3, contractAddress);
            blockNumber++
            console.log(`Waiting for ${waitTime} seconds`)
        } else {
            await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
        }
    }
}

async function checkTransactions (txs, web3, contractAddress) {
    const inputs = [
        {
            type: 'string',
            name: 'txHash'
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
        const tx = await web3.eth.getTransaction(txs[i])
        if(tx.to === contractAddress){
            const txReceipt = await web3.eth.getTransactionReceipt(txs[i])
            txReceipt.logs.forEach(log => {
                console.log('log decoded ', web3.eth.abi.decodeLog(inputs, log.data, log.topics));
                log.topics.forEach((topic, index) => {
                    console.log('topics ', web3.eth.abi.decodeParameter('uint', topic))
                });
            });
            console.log(`Transaction ${tx.hash} is sent to contract ${contractAddress}`)
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

