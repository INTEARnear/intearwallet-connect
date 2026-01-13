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
}
/**
 * IntearWalletConnector - A lightweight connector for Intear Wallet
 */
export declare class IntearWalletConnector {
    #private;
    walletUrl: string | null;
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
     * @param networkId - The network ID to connect to
     * @param walletUrl - The URL of the wallet to connect to
     * @returns A promise that resolves with the connected account, or null if user has rejected the connection
     * @throws Error If the failed to open the wallet popup or already connected
     */
    requestConnection(networkId?: string, walletUrl?: string): Promise<ConnectedAccount | null>;
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
