/********************************************
 * client/src/App.js
 ********************************************/
import React, { useState } from 'react';
import axios from 'axios';
import './styles.css';

function App() {
  const [mnemonicText, setMnemonicText] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);

  const handleCheck = async () => {
    // Textarea'daki her satır bir mnemonic
    const lines = mnemonicText
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      alert("Lütfen en az 1 mnemonic girin.");
      return;
    }

    setLoading(true);
    setResults([]);

    try {
      // Server'a POST isteği
      const resp = await axios.post('/checkBalances', {
        mnemonics: lines
      });
      setResults(resp.data.results || []);
    } catch (err) {
      console.error(err);
      alert("Sunucu hatası: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 className="title">TrustWallet Balance Checker</h1>

      <div className="card">
        <p>Her satıra 12 kelimelik mnemonic girin:</p>
        <textarea
          rows={6}
          value={mnemonicText}
          onChange={(e) => setMnemonicText(e.target.value)}
          placeholder="cushion venture peasant zero dizzy across demand economy label liberty armed fiction"
        />
        <button onClick={handleCheck} disabled={loading}>
          {loading ? "Sorgulanıyor..." : "Sorgula"}
        </button>
      </div>

      {loading && (
        <div className="loader">
          <div className="spinner"></div>
          <p>Sorgulanıyor, lütfen bekleyin...</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="results">
          <h2>Sonuçlar</h2>
          <table>
            <thead>
              <tr>
                <th>Mnemonic</th>
                <th>Bakiye</th>
              </tr>
            </thead>
            <tbody>
              {results.map((item, idx) => {
                if (item.error) {
                  return (
                    <tr key={idx}>
                      <td>{item.mnemonic}</td>
                      <td className="error">Hata: {item.error}</td>
                    </tr>
                  );
                }
                if (item.empty) {
                  return (
                    <tr key={idx}>
                      <td>{item.mnemonic}</td>
                      <td>Empty</td>
                    </tr>
                  );
                }
                const balanceStr = Object.entries(item.balances)
                  .map(([coin, val]) => `${val} ${coin}`)
                  .join(", ");
                return (
                  <tr key={idx}>
                    <td>{item.mnemonic}</td>
                    <td>{balanceStr}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default App;
