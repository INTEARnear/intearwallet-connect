/**
 * The native wallet URL for Intear Wallet desktop/mobile apps.
 * Use this as the walletUrl option to connect via the native app instead of web popup.
 */
export declare const INTEAR_NATIVE_WALLET_URL: "intear://";
/**
 * Use a selector iframe to let the user choose which way to connect. This is the
 * preferred way for most dapps, since the user can be using staging or native app,
 * so you don't have to implement the selector yourself.
 * @param walletUrl - Origin of the iframe (where the iframe .html is loaded from).
 * @returns The valid walletUrl parameter that you can use in requestConnection call.
 */
export declare function iframe(walletUrl?: string): string;
/**
 * Storage - A storage interface that is used by the connector to store its internal data
 */
export interface Storage {
    /**
     * Gets the data stored in the storage
     * @param key - The key to get the data for
     * @returns The data stored in the storage
     */
    get(key: string): Promise<any | null>;
    /**
     * Sets the data in the storage
     * @param key - The key to set the data for
     * @param value - The data to set
     * @returns The previous value stored in the storage, or null if
     * there was no previous value with this key
     */
    set(key: string, value: any): Promise<any | null>;
    /**
     * Removes the data from the storage
     * @param key - The key to remove the data for
     * @returns The previous value stored in the storage, or null if
     * there was no value stored with this key
     */
    remove(key: string): Promise<any | null>;
}
/**
 * NEP-413 message payload for signing
 */
export interface Nep413Payload {
    /**
     * The message to sign, usually a human-readable string that is displayed in the wallet,
     * or sometimes a JSON representation of Near Intents, that has a special handling for
     * displaying intents in the wallet.
     */
    message: string;
    /**
     * The nonce of the message, 32 bytes
     */
    nonce: Uint8Array;
    /**
     * The recipient of the message, usually account ID of a smart contract or a web app domain
     */
    recipient: string;
    /**
     * Ignored by the wallet, but required by NEP-413
     */
    callbackUrl?: string | null;
    /**
     * State that will be returned in the signed message payload. Useless (you can just
     * create a variable and use it after `await`ing the promise), but required by NEP-413
     */
    state?: string | null;
}
/**
 * Signed message response from the wallet, as per NEP-413
 */
export interface SignedMessage {
    /**
     * The account ID that signed the message. Guaranteed to be the same as the connected account
     */
    accountId: string;
    /**
     * The public key that was used to sign the message.
     */
    publicKey: string;
    /**
     * Base64 encoded signature of the message.
     */
    signature: string;
    /**
     * Same as in Nep413Payload.state
     */
    state?: string | null;
}
/**
 * Result of sending transactions to the wallet.
 * Contains the execution outcomes for each transaction.
 */
export interface SendTransactionsResult {
    /**
     * Array of execution outcomes for each transaction, in the same order as the transactions were sent.
     * Each outcome is the FinalExecutionOutcomeViewEnum as returned by NEAR RPC.
     */
    outcomes: object[];
}
/**
 * Options for requesting a connection to the Intear Wallet
 */
export interface ConnectionOptions {
    /**
     * The network ID to connect to (defaults to 'mainnet')
     */
    networkId?: string;
    /**
     * The URL of the wallet to connect to (defaults to 'https://wallet.intear.tech').
     * Use INTEAR_NATIVE_WALLET_URL ('intear://') to connect via the native desktop/mobile app.
     */
    walletUrl?: typeof INTEAR_NATIVE_WALLET_URL | string;
    /**
     * The logout bridge WebSocket URL for native app communication.
     * Only used when walletUrl is INTEAR_NATIVE_WALLET_URL.
     * Defaults to 'wss://logout-bridge-service.intear.tech'.
     */
    logoutBridgeUrl?: string;
    /**
     * Optional NEP-413 message to sign during connection
     */
    messageToSign?: Nep413Payload;
    /**
     * The relayer ID to use for new account onboarding, which allows users to create
     * branded subaccounts, like user123.intears.near. You can get your relayer ID on
     * https://rainy.intea.rs
     */
    relayerId?: string;
}
/**
 * Result of a successful connection to the Intear Wallet
 */
export interface ConnectionResult {
    /**
     * The connected account
     */
    account: ConnectedAccount;
    /**
     * The signed message, if messageToSign was provided in ConnectionOptions
     */
    signedMessage?: SignedMessage;
}
/**
 * ConnectedAccount - A connected Intear Wallet account and its data
 */
declare class ConnectedAccount {
    #private;
    accountId: string;
    disconnected: boolean;
    /**
     * @deprecated Don't use this constructor directly, this class should only be instantiated by the connector
     */
    constructor(accountId: string, connector: IntearWalletConnector);
    /**
     * Disconnects the account from the connector
     */
    disconnect(): void;
    /**
     * Signs a message using NEP-413 standard via wallet popup
     * @param messageToSign - The NEP-413 message payload to sign
     * @returns A promise that resolves with the signed message, or null if user rejected
     * @throws Error if not connected, nonce is not 32 bytes, or signing fails
     */
    signMessage(messageToSign: Nep413Payload): Promise<SignedMessage | null>;
    /**
     * Sends transactions to be signed and executed via wallet popup
     * @param transactions - Array of transactions to send. Each transaction specifies signerId, receiverId, and actions.
     * @returns A promise that resolves with the execution outcomes, or null if user rejected
     * @throws Error if not connected or sending fails
     */
    sendTransactions(transactions: Transaction[]): Promise<SendTransactionsResult | null>;
}
/**
 * IntearWalletConnector - A lightweight connector for Intear Wallet
 */
export declare class IntearWalletConnector {
    #private;
    walletUrl?: typeof INTEAR_NATIVE_WALLET_URL | string;
    logoutBridgeUrl?: string;
    storage: Storage;
    /**
     * Creates a new IntearWalletConnector instance
     * @param storage - The storage to load the connected account from
     * @returns A promise that resolves with the IntearWalletConnector instance
     */
    static loadFrom(storage: Storage): Promise<IntearWalletConnector>;
    private constructor();
    /**
     * Gets the currently connected account
     * @returns The connected account object or null if not connected
     */
    get connectedAccount(): ConnectedAccount | null;
    /**
     * Requests a connection to the Intear Wallet
     * @param options - Connection options including networkId, walletUrl, and optional messageToSign
     * @returns A promise that resolves with the connection result, or null if user has rejected the connection
     * @throws Error If the failed to open the wallet popup or already connected
     */
    requestConnection(options?: ConnectionOptions): Promise<ConnectionResult | null>;
    /**
     * Disconnects from the Intear Wallet
     * @throws Error If the account is not connected
     */
    disconnect(): Promise<void>;
}
/**
 * InMemoryStorage - An in-memory storage implementation that is not persisted
 */
export declare class InMemoryStorage implements Storage {
    private data;
    /**
     * Creates a new, empty InMemoryStorage instance
     */
    constructor();
    /**
     * Gets the data stored in the storage
     * @returns The data stored in the storage
     */
    getData(): Map<string, any>;
    /**
     * Clones the storage
     * @returns A new InMemoryStorage instance with the same data. Modifying
     * the clone will not affect the original storage, and vice versa.
     */
    clone(): InMemoryStorage;
    get(key: string): Promise<any | null>;
    set(key: string, value: any): Promise<any | null>;
    remove(key: string): Promise<any | null>;
}
/**
 * LocalStorageStorage - A localStorage-backed storage implementation
 */
export declare class LocalStorageStorage implements Storage {
    private prefix;
    private storage;
    /**
     * Creates a new LocalStorageStorage instance
     * @param prefix - The prefix to apply to all keys
     * @param storage - The storage to use for storing the data. You can pass
     * your own localStorage-compatible object, like sessionStorage.
     * @throws Error If localStorage is not available
     */
    constructor(prefix: string, storage?: globalThis.Storage);
    /**
     * Prefixes the key and returns the key that corresponds to localStorage
     */
    private _getPrefixedKey;
    get(key: string): Promise<any | null>;
    set(key: string, value: any): Promise<any | null>;
    remove(key: string): Promise<any | null>;
}
export default IntearWalletConnector;
export type SelectorAction = LegacySelectorAction | NearAction;
export interface LegacyCreateAccountAction {
    type: "CreateAccount";
}
export interface LegacyDeployContractAction {
    type: "DeployContract";
    params: {
        code: number[];
    };
}
export interface LegacyFunctionCallAction {
    type: "FunctionCall";
    params: {
        methodName: string;
        args: object;
        gas: string;
        deposit: string;
    };
}
export interface LegacyTransferAction {
    type: "Transfer";
    params: {
        deposit: string;
    };
}
export interface LegacyStakeAction {
    type: "Stake";
    params: {
        stake: string;
        publicKey: string;
    };
}
export type AddKeyPermission = "FullAccess" | {
    receiverId: string;
    allowance?: string;
    methodNames?: Array<string>;
};
export interface LegacyAddKeyAction {
    type: "AddKey";
    params: {
        publicKey: string;
        accessKey: {
            nonce?: number;
            permission: AddKeyPermission;
        };
    };
}
export interface LegacyDeleteKeyAction {
    type: "DeleteKey";
    params: {
        publicKey: string;
    };
}
export interface LegacyDeleteAccountAction {
    type: "DeleteAccount";
    params: {
        beneficiaryId: string;
    };
}
export interface LegacyUseGlobalContractAction {
    type: "UseGlobalContract";
    params: {
        contractIdentifier: {
            accountId: string;
        } | {
            codeHash: string;
        };
    };
}
export interface LegacyDeployGlobalContractAction {
    type: "DeployGlobalContract";
    params: {
        code: number[];
        deployMode: "CodeHash" | "AccountId";
    };
}
export type LegacySelectorAction = LegacyCreateAccountAction | LegacyDeployContractAction | LegacyFunctionCallAction | LegacyTransferAction | LegacyStakeAction | LegacyAddKeyAction | LegacyDeleteKeyAction | LegacyDeleteAccountAction | LegacyUseGlobalContractAction | LegacyDeployGlobalContractAction;
export type AccessKeyPermission = "FullAccess" | {
    FunctionCall: {
        allowance: string | null;
        receiver_id: string;
        method_names: string[];
    };
};
export interface AddKeyAction {
    public_key: string;
    access_key: {
        nonce: number;
        permission: AccessKeyPermission;
    };
}
export interface CreateAccountAction {
}
export interface DeleteAccountAction {
    beneficiary_id: string;
}
export interface DeleteKeyAction {
    public_key: string;
}
export interface DeployContractAction {
    code: string;
}
export interface DeployGlobalContractAction {
    code: string;
    deploy_mode: "CodeHash" | "AccountId";
}
export type GlobalContractIdentifier = {
    CodeHash: string;
} | {
    AccountId: string;
};
export interface UseGlobalContractAction {
    contract_identifier: GlobalContractIdentifier;
}
export interface FunctionCallAction {
    method_name: string;
    args: string;
    gas: string | number;
    deposit: string;
}
export interface StakeAction {
    stake: string;
    public_key: string;
}
export interface TransferAction {
    deposit: string;
}
export type NearAction = {
    CreateAccount: CreateAccountAction;
} | {
    DeployContract: DeployContractAction;
} | {
    FunctionCall: FunctionCallAction;
} | {
    Transfer: TransferAction;
} | {
    Stake: StakeAction;
} | {
    AddKey: AddKeyAction;
} | {
    DeleteKey: DeleteKeyAction;
} | {
    DeleteAccount: DeleteAccountAction;
} | {
    DeployGlobalContract: DeployGlobalContractAction;
} | {
    UseGlobalContract: UseGlobalContractAction;
};
export interface Transaction {
    signerId: string;
    receiverId: string;
    actions: Array<SelectorAction>;
}
