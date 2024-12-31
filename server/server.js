/********************************************
 * server/server.js
 ********************************************/
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bip39 = require('bip39');
const hdkey = require('hdkey');
const TronWeb = require('tronweb');
const { keccak256 } = require('js-sha3');
const { Buffer } = require('buffer'); // Node.js buffer

const app = express();
app.use(express.json());
app.use(cors());

// BscScan API Key (BURAYI DOLDUR)
const BSC_API_KEY = "5KGHGER1J7338ICMBEMFJP6639EX5UC9G9";

/********************************************
 * 1) BSC (BNB/BUSD) Adres-Bakiye Sorgu
 ********************************************/
function getBscAddressFromMnemonic(mnemonic) {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Geçersiz mnemonic");
  }
  // 1) Seed
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  // 2) HD root
  const root = hdkey.fromMasterSeed(seed);
  // 3) EVM path -> m/44'/60'/0'/0/0
  const child = root.derive("m/44'/60'/0'/0/0");
  // 4) publicKey
  const publicKey = child.publicKey; // 33 veya 65 bayt olabilir
  // 5) keccak256(publicKey.slice(1)) son 20 byte -> 0x + hex
  const hashedArray = keccak256.array(publicKey.slice(1));
  const hashedBuffer = Buffer.from(hashedArray);
  const addressBuffer = hashedBuffer.slice(-20);
  return '0x' + addressBuffer.toString('hex');
}

async function getBscBalances(mnemonic) {
  const address = getBscAddressFromMnemonic(mnemonic);

  // -- BNB bakiyesi --
  const bnbUrl = `https://api.bscscan.com/api
    ?module=account
    &action=balance
    &address=${address}
    &tag=latest
    &apikey=${BSC_API_KEY}`.replace(/\s+/g, "");
  const bnbResp = await axios.get(bnbUrl);
  const bnbWei = bnbResp.data.result;
  const bnb = parseFloat(bnbWei) / 1e18;

  // -- BUSD bakiyesi --
  const busdUrl = `https://api.bscscan.com/api
    ?module=account
    &action=tokenbalance
    &contractaddress=0xe9e7cea3dedca5984780bafc599bd69add087d56
    &address=${address}
    &tag=latest
    &apikey=${BSC_API_KEY}`.replace(/\s+/g, "");
  const busdResp = await axios.get(busdUrl);
  const busdRaw = busdResp.data.result;
  const busd = parseFloat(busdRaw) / 1e18;

  return { BNB: bnb, BUSD: busd };
}

/********************************************
 * 2) Tron (TRX) Adres-Bakiye Sorgu
 ********************************************/
function getTronPrivateKeyFromMnemonic(mnemonic) {
  if (!bip39.validateMnemonic(mnemonic)) {
    throw new Error("Geçersiz mnemonic");
  }
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const root = hdkey.fromMasterSeed(seed);
  // Tron: m/44'/195'/0'/0/0
  const child = root.derive("m/44'/195'/0'/0/0");
  return child.privateKey.toString('hex');
}

async function getTronBalance(mnemonic) {
  const privateKeyHex = getTronPrivateKeyFromMnemonic(mnemonic);

  const tronWeb = new TronWeb({
    fullHost: 'https://api.trongrid.io',
    privateKey: privateKeyHex
  });
  const address = tronWeb.address.fromPrivateKey(privateKeyHex);

  // TRX bakiyesi (Sun cinsinden döner, 1 TRX = 1e6 Sun)
  const balanceInSun = await tronWeb.trx.getBalance(address);
  return balanceInSun / 1e6;
}

/********************************************
 * 3) Express Endpoint: /checkBalances
 ********************************************/
app.post('/checkBalances', async (req, res) => {
  try {
    const { mnemonics } = req.body;
    if (!mnemonics || !Array.isArray(mnemonics)) {
      return res.status(400).json({ error: "mnemonics array olmalı" });
    }

    const results = [];
    for (const mnemonic of mnemonics) {
      try {
        // Paralel sorgu: BSC + Tron
        const [bsc, tron] = await Promise.all([
          getBscBalances(mnemonic),
          getTronBalance(mnemonic)
        ]);
        const BNB = bsc.BNB;
        const BUSD = bsc.BUSD;
        const TRX = tron;

        // 0 olmayanları birleştir
        const nonZero = {};
        if (BNB > 0) nonZero.BNB = BNB;
        if (BUSD > 0) nonZero.BUSD = BUSD;
        if (TRX > 0) nonZero.TRX = TRX;

        results.push({
          mnemonic,
          balances: nonZero,
          empty: (Object.keys(nonZero).length === 0)
        });
      } catch (err) {
        results.push({
          mnemonic,
          error: err.message
        });
      }
    }

    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 4) Sunucuyu başlat
const PORT = 4000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
