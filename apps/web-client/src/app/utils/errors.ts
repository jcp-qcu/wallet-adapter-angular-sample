import { WalletError } from '@solana/wallet-adapter-base';

export class WalletNotSelectedError extends WalletError {
  constructor() {
    super();
    this.name = 'WalletNotSelectedError';
  }
}
