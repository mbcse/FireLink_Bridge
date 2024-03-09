const Web3 = require('web3');

let blockNumber = 23473761
const waitTime = 10 // seconds

const chainData = {
    53935: {name:"DFK Mainnet", exploreLink: 'https://subnets.avax.network/defi-kingdoms'} 
}

const runContractListner = async (contractAddress, rpcUrl) => {

const web3 = new Web3(rpcUrl)
const chainId = await web3.eth.getChainId()
const networkName = chainData[chainId].name
const exploreLink = chainData[chainId].exploreLink
console.log(`Contract Listner Started for contract ${contractAddress} on chain ${chainId}`)

while(true){
    console.log(`Checking block ${blockNumber}`)
    const getBlock = await web3.eth.getBlock(blockNumber)
    const txs = getBlock.transactions
    // console.log(getBlock)
    for(let i = 0; i < txs.length; i++){
        const tx = await web3.eth.getTransaction(txs[i])
        // console.log(tx)
        if(tx.to === contractAddress){
            const txReceipt = await web3.eth.getTransactionReceipt(txs[i])
            console.log(txReceipt)
            console.log(`Transaction ${tx.hash} is sent to contract ${contractAddress}`)
            const hashLink = exploreLink+"/tx/"+tx.hash
            const when = new Date(getBlock.timestamp*1000)
            if(txReceipt.status){
            }else{
                console.log(`Transaction ${tx.hash} is failed`)
            }    
        }
    }

    blockNumber++
    console.log(`Waiting for ${waitTime} seconds`)
    await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));

}


}

module.exports = {
    runContractListner
}

