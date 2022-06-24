import { Component } from '@angular/core';
import { FormBuilder, FormControl } from '@angular/forms';
import { ConnectionStore, WalletStore } from '@heavy-duty/wallet-adapter';
import { WalletName, WalletReadyState } from '@solana/wallet-adapter-base';
import { PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { encode } from 'bs58';
import { defer, from, throwError } from 'rxjs';
import { concatMap, first, map } from 'rxjs/operators';
import { isNotNull } from './operators';

@Component({
  selector: 'wa-home',
  template: `
    <div
      class="login-container login login-1 login-auth-on d-flex flex-column flex-lg-row flex-row-fluid bg-white"
    >
      <div
        class="login-aside d-flex flex-row-auto bgi-size-cover bgi-no-repeat p-10 p-lg-10"
      ></div>

      <div
        class="login-aside-right container flex-row-fluid d-flex flex-column position-relative p-7 overflow-hidden"
      >
        <div
          class="aside-right-inner d-flex flex-column-fluid flex-center mt-30 mt-lg-0"
        >
          <div class="login-form login-auth">
            <div class="mb-1r">
              <div class="d-flex">
                <h3 class="sign-in-header">WELCOME BACK</h3>
              </div>

              <div class="form-group">
                <div
                  class="mt37 form-group d-flex flex-wrap justify-content-between align-items-center"
                >
                  <div class="mb-4">
                    <hd-wallet-multi-button></hd-wallet-multi-button>
                  </div>

                  <p
                    class="bg-black bg-opacity-10 px-4 py-2 rounded-md inline-block"
                    *ngIf="publicKey$ | async as publicKey"
                  >
                    <span>
                      {{ publicKey.toBase58() }}
                    </span>

                    <button
                      mat-icon-button
                      [cdkCopyToClipboard]="publicKey.toBase58()"
                    >
                      <mat-icon>content_copy</mat-icon>
                    </button>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class HomeComponent {
  readonly connection$ = this._connectionStore.connection$;
  readonly wallets$ = this._walletStore.wallets$;
  readonly wallet$ = this._walletStore.wallet$;
  readonly walletName$ = this.wallet$.pipe(
    map((wallet) => wallet?.adapter.name || null)
  );
  readonly ready$ = this.wallet$.pipe(
    map(
      (wallet) =>
        wallet &&
        (wallet.adapter.readyState === WalletReadyState.Installed ||
          wallet.adapter.readyState === WalletReadyState.Loadable)
    )
  );
  readonly connected$ = this._walletStore.connected$;
  readonly publicKey$ = this._walletStore.publicKey$;
  lamports = 0;
  recipient = '';
  readonly form = this._formBuilder.group<{
    recipient: FormControl<string | null>;
    lamports: FormControl<number | null>;
  }>({
    recipient: this._formBuilder.control(null),
    lamports: this._formBuilder.control(null),
  });

  constructor(
    private readonly _formBuilder: FormBuilder,
    private readonly _connectionStore: ConnectionStore,
    private readonly _walletStore: WalletStore
  ) {}

  onConnect() {
    this._walletStore.connect().subscribe();
  }

  onDisconnect() {
    this._walletStore.disconnect().subscribe();
  }

  onSelectWallet(walletName: WalletName) {
    this._walletStore.selectWallet(walletName);
  }

  onSendTransaction(fromPubkey: PublicKey) {
    const { lamports, recipient } = this.form.value;

    if (!lamports || !recipient) {
      throw new Error('Invalid data');
    }

    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getLatestBlockhash())).pipe(
            concatMap(({ blockhash, lastValidBlockHeight }) =>
              this._walletStore.sendTransaction(
                new Transaction({
                  blockhash,
                  feePayer: fromPubkey,
                  lastValidBlockHeight,
                }).add(
                  SystemProgram.transfer({
                    fromPubkey,
                    toPubkey: new PublicKey(recipient),
                    lamports,
                  })
                ),
                connection
              )
            )
          )
        )
      )
      .subscribe({
        next: (signature) => console.log(`Transaction sent (${signature})`),
        error: (error) => console.error(error),
      });
  }

  onSignTransaction(fromPubkey: PublicKey) {
    const { lamports, recipient } = this.form.value;

    if (!lamports || !recipient) {
      throw new Error('Invalid data');
    }

    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getLatestBlockhash())).pipe(
            map(({ blockhash, lastValidBlockHeight }) =>
              new Transaction({
                blockhash,
                feePayer: fromPubkey,
                lastValidBlockHeight,
              }).add(
                SystemProgram.transfer({
                  fromPubkey,
                  toPubkey: new PublicKey(recipient),
                  lamports,
                })
              )
            )
          )
        ),
        concatMap((transaction) => {
          const signTransaction$ =
            this._walletStore.signTransaction(transaction);

          if (!signTransaction$) {
            return throwError(
              () => new Error('Sign transaction method is not defined')
            );
          }

          return signTransaction$;
        })
      )
      .subscribe({
        next: (transaction) => console.log('Transaction signed', transaction),
        error: (error) => console.error(error),
      });
  }

  onSignAllTransactions(fromPubkey: PublicKey) {
    const { lamports, recipient } = this.form.value;

    if (!lamports || !recipient) {
      throw new Error('Invalid data');
    }

    this.connection$
      .pipe(
        first(),
        isNotNull,
        concatMap((connection) =>
          from(defer(() => connection.getLatestBlockhash())).pipe(
            map(({ blockhash, lastValidBlockHeight }) =>
              new Array(3).fill(0).map(() =>
                new Transaction({
                  blockhash,
                  feePayer: fromPubkey,
                  lastValidBlockHeight,
                }).add(
                  SystemProgram.transfer({
                    fromPubkey,
                    toPubkey: new PublicKey(recipient),
                    lamports,
                  })
                )
              )
            )
          )
        ),
        concatMap((transactions) => {
          const signAllTransaction$ =
            this._walletStore.signAllTransactions(transactions);

          if (!signAllTransaction$) {
            return throwError(
              () => new Error('Sign all transactions method is not defined')
            );
          }

          return signAllTransaction$;
        })
      )
      .subscribe({
        next: (transactions) =>
          console.log('Transactions signed', transactions),
        error: (error) => console.error(error),
      });
  }

  onSignMessage() {
    const signMessage$ = this._walletStore.signMessage(
      new TextEncoder().encode('Hello world!')
    );

    if (!signMessage$) {
      return console.error(new Error('Sign message method is not defined'));
    }

    signMessage$.pipe(first()).subscribe((signature) => {
      console.log(`Message signature: ${{ encode }.encode(signature)}`);
    });
  }
}
