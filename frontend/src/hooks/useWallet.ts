import { useState, useEffect } from "react";
import { WalletClient } from "@bsv/sdk";

export const useWallet = () => {
  const [wallet, setWallet] = useState<WalletClient | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeWallet = async () => {
      try {
        const client = new WalletClient();
        setWallet(client);
        setError(null);
      } catch (err) {
        console.error("Error initializing wallet:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize wallet");
        setWallet(null);
      }
    };

    initializeWallet();
  }, []);

  return { wallet, error };
};
