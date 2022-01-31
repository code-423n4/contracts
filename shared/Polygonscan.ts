import fetch from 'node-fetch';

export async function getABIFromPolygonscan(address: string) {
  if (process.env.POLYGONSCAN_API_KEY == undefined) {
    console.log('Require polygonscan key, exiting...');
    process.exit(1);
  }

  let abiRequest = await fetch(
    `https://api.polygonscan.com/api?module=contract&action=getabi` +
      `&address=${address}` +
      `&apikey=${process.env.POLYGONSCAN_API_KEY}`
  );
  let abi = await abiRequest.json();
  if (abi.status == '0') {
    console.log(abi.result);
    process.exit(1);
  }
  return abi.result;
}
