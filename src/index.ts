/**
 * Decodes a base64url string to byte array
 * @param str - The base64 or base64url encoded string
 * @returns The decoded byte array
 */
function base64Decode(str: string): Uint8Array {
    const binaryString = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binaryString, char => char.charCodeAt(0));
}

/**
 * Encodes a byte array to base64 string
 * @param bytes - The byte array to encode
 * @returns The base64 encoded string
 */
function base64Encode(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes));
}

/**
 * Encodes a byte array to base58 string
 * @param bytes - The byte array to encode
 * @returns The base58 encoded string
 */
function base58Encode(bytes: Uint8Array | Iterable<number>): string {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    let bytesArray: Uint8Array;
    if (!(bytes instanceof Uint8Array)) {
        bytesArray = Uint8Array.from(bytes);
    } else {
        bytesArray = bytes;
    }

    let zeroCount = 0;
    while (zeroCount < bytesArray.length && bytesArray[zeroCount] === 0) {
        zeroCount++;
    }

    const digits: number[] = [];
    for (let i = zeroCount; i < bytesArray.length; i++) {
        let carry = bytesArray[i];
        for (let j = 0; j < digits.length; j++) {
            carry += digits[j] << 8;
            digits[j] = carry % 58;
            carry = (carry / 58) | 0;
        }
        while (carry > 0) {
            digits.push(carry % 58);
            carry = (carry / 58) | 0;
        }
    }

    let result = "";
    for (let i = 0; i < zeroCount; i++) {
        result += ALPHABET[0];
    }

    for (let i = digits.length - 1; i >= 0; i--) {
        result += ALPHABET[digits[i]];
    }

    return result;
}

/**
 * Decodes a base58 string to byte array
 * @param str - The base58 encoded string
 * @returns The decoded byte array
 */
function base58Decode(str: string): Uint8Array {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    const ALPHABET_MAP: { [key: string]: number } = {};
    for (let i = 0; i < ALPHABET.length; i++) {
        ALPHABET_MAP[ALPHABET[i]] = i;
    }

    let zeroCount = 0;
    while (zeroCount < str.length && str[zeroCount] === ALPHABET[0]) {
        zeroCount++;
    }

    const bytes: number[] = [];
    for (let i = zeroCount; i < str.length; i++) {
        const char = str[i];
        if (!(char in ALPHABET_MAP)) {
            throw new Error(`Invalid base58 character: ${char}`);
        }
        let carry = ALPHABET_MAP[char];
        for (let j = 0; j < bytes.length; j++) {
            carry += bytes[j] * 58;
            bytes[j] = carry & 0xff;
            carry >>= 8;
        }
        while (carry > 0) {
            bytes.push(carry & 0xff);
            carry >>= 8;
        }
    }

    const result = new Uint8Array(zeroCount + bytes.length);
    for (let i = 0; i < zeroCount; i++) {
        result[i] = 0;
    }
    for (let i = 0; i < bytes.length; i++) {
        result[zeroCount + bytes.length - 1 - i] = bytes[i];
    }

    return result;
}

/**
 * Configuration for popup flow
 */
interface PopupFlowConfig<TResponse> {
    /** URL path to open in the popup (appended to walletUrl) or page of intear:// url */
    path: string;
    /** Wallet base URL */
    walletUrl: "intear://" | string;
    /** Message type to send when popup is ready */
    sendMessageType: string;
    /** Data to send to the popup */
    sendData: any;
    /** Message type indicating success */
    successMessageType: string;
    /** Transform successful response data (can be async) */
    onSuccess: (data: any) => TResponse | Promise<TResponse>;
    /** Optional: handle user rejection errors, return value to resolve with */
    isUserRejection?: (errorMessage: string) => boolean;
}

/**
 * Opens a popup and handles the message flow with the wallet
 * @param config - Configuration for the popup flow
 * @returns A promise that resolves with the response, or null if user rejected/closed
 * @throws Error if popup fails to open or wallet returns an error
 */
async function openPopupFlow<TResponse>(config: PopupFlowConfig<TResponse>): Promise<TResponse | null> {
    const popup = window.open(
        `${config.walletUrl}${config.path}`,
        "_blank",
        'width=400,height=700,scrollbars=yes,resizable=yes'
    );

    if (!popup) {
        throw new Error('Failed to open wallet popup.');
    }

    return new Promise<TResponse | null>((resolve, reject) => {
        let resultReceived = false;

        const cleanup = () => {
            window.removeEventListener('message', messageHandler);
            if (checkClosed) {
                clearInterval(checkClosed);
            }
        };

        const messageHandler = async (event: MessageEvent) => {
            if (event.origin !== config.walletUrl) {
                return;
            }

            try {
                const data = event.data;

                if (data.type === 'ready') {
                    popup.postMessage(
                        {
                            type: config.sendMessageType,
                            data: config.sendData
                        },
                        config.walletUrl
                    );
                } else if (data.type === config.successMessageType && !resultReceived) {
                    resultReceived = true;
                    cleanup();
                    popup.close();
                    try {
                        resolve(await config.onSuccess(data));
                    } catch (err) {
                        reject(err);
                    }
                } else if (data.type === 'error' && !resultReceived) {
                    resultReceived = true;
                    cleanup();
                    popup.close();
                    if (config.isUserRejection?.(data.message)) {
                        resolve(null);
                    } else {
                        reject(new Error(data.message || 'Operation failed'));
                    }
                }
            } catch (error) {
                // Ignore JSON parse errors from other messages
            }
        };

        window.addEventListener('message', messageHandler);

        const checkClosed = setInterval(() => {
            if (popup.closed && !resultReceived) {
                cleanup();
                if (!resultReceived) {
                    resolve(null);
                }
            }
        }, 100);
    });
}

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
 * Options for requesting a connection to the Intear Wallet
 */
export interface ConnectionOptions {
    /**
     * The network ID to connect to (defaults to 'mainnet')
     */
    networkId?: string;
    /**
     * The URL of the wallet to connect to (defaults to 'https://wallet.intear.tech')
     */
    walletUrl?: string;
    /**
     * Optional NEP-413 message to sign during connection
     */
    messageToSign?: Nep413Payload;
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
class ConnectedAccount {
    accountId: string;
    disconnected: boolean;
    #connector: IntearWalletConnector;

    /**
     * @deprecated Don't use this constructor directly, this class should only be instantiated by the connector
     */
    constructor(accountId: string, connector: IntearWalletConnector) {
        this.accountId = accountId;
        this.#connector = connector;
        this.disconnected = false;
    }

    /**
     * Disconnects the account from the connector
     */
    disconnect(): void {
        this.#connector.disconnect();
    }

    /**
     * Signs a message using NEP-413 standard via wallet popup
     * @param messageToSign - The NEP-413 message payload to sign
     * @returns A promise that resolves with the signed message, or null if user rejected
     * @throws Error if not connected, nonce is not 32 bytes, or signing fails
     */
    async signMessage(messageToSign: Nep413Payload): Promise<SignedMessage | null> {
        if (this.disconnected) {
            throw new Error('Account is disconnected');
        }
        if (messageToSign.nonce.length !== 32) {
            throw new Error('Nonce must be 32 bytes');
        }

        if (!this.#connector.walletUrl) {
            throw new Error('Wallet URL not available');
        }

        const privateKeyJwk = await this.#connector.storage.get(STORAGE_KEY_APP_PRIVATE_KEY);
        if (!privateKeyJwk) {
            throw new Error('Private key not found in storage');
        }

        const privateKey = await crypto.subtle.importKey(
            'jwk',
            privateKeyJwk,
            { name: 'Ed25519' },
            true,
            ['sign']
        );
        const publicKeyBytes = base64Decode(privateKeyJwk.x);
        const publicKeyBase58 = base58Encode(publicKeyBytes);
        const publicKey = `ed25519:${publicKeyBase58}`;

        const nep413Payload = JSON.stringify({
            message: messageToSign.message,
            nonce: Array.from(messageToSign.nonce),
            recipient: messageToSign.recipient,
            callback_url: messageToSign.callbackUrl ?? null,
            state: messageToSign.state ?? null
        });

        const nonce = Date.now();
        const messageToHash = `${nonce}|${nep413Payload}`;
        const hashedMessage = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(messageToHash));

        const signatureBuffer = await crypto.subtle.sign(
            { name: 'Ed25519' },
            privateKey,
            hashedMessage
        );

        const signatureBytes = new Uint8Array(signatureBuffer);
        const signatureBase58 = base58Encode(signatureBytes);
        const signature = `ed25519:${signatureBase58}`;

        const signMessageData = {
            message: nep413Payload,
            accountId: this.accountId,
            publicKey,
            nonce,
            signature
        };

        const walletUrl = this.#connector.walletUrl;

        return openPopupFlow<SignedMessage>({
            path: '/sign-message',
            walletUrl,
            sendMessageType: 'signMessage',
            sendData: signMessageData,
            successMessageType: 'signed',
            onSuccess: (data) => {
                const signatureWithoutPrefix = data.signature.signature.split(':')[1];
                const signatureBytes = base58Decode(signatureWithoutPrefix);
                const signatureBase64 = base64Encode(signatureBytes);
                return {
                    accountId: data.signature.accountId,
                    publicKey: data.signature.publicKey,
                    signature: signatureBase64,
                    state: data.signature.state
                };
            },
            isUserRejection: (msg) => msg === "User rejected the signature"
        });
    }
}

const STORAGE_KEY_ACCOUNT_ID = 'accountId';
const STORAGE_KEY_APP_PRIVATE_KEY = 'appPrivateKey';
const STORAGE_KEY_WALLET_URL = 'walletUrl';

/**
 * IntearWalletConnector - A lightweight connector for Intear Wallet
 */
export class IntearWalletConnector {
    #connectedAccount: ConnectedAccount | null;
    walletUrl?: "intear://" | string;
    storage: Storage;

    /**
     * Creates a new IntearWalletConnector instance
     * @param storage - The storage to load the connected account from
     * @returns A promise that resolves with the IntearWalletConnector instance
     */
    static async loadFrom(storage: Storage): Promise<IntearWalletConnector> {
        if (!storage) {
            throw new Error('loadFrom: Invalid arguments');
        }
        const accountId = await storage.get(STORAGE_KEY_ACCOUNT_ID);
        const walletUrl = await storage.get(STORAGE_KEY_WALLET_URL);
        const connector = new IntearWalletConnector(storage, null, walletUrl);
        const connectedAccount = accountId ? new ConnectedAccount(accountId, connector) : null;
        connector.#connectedAccount = connectedAccount;
        return connector;
    }

    private constructor(storage: Storage, connectedAccount: ConnectedAccount | null, walletUrl: "intear://" | string) {
        this.storage = storage;
        this.#connectedAccount = connectedAccount;
        this.walletUrl = walletUrl;
    }

    /**
     * Gets the currently connected account
     * @returns The connected account object or null if not connected
     */
    get connectedAccount(): ConnectedAccount | null {
        return this.#connectedAccount;
    }

    /**
     * Requests a connection to the Intear Wallet
     * @param options - Connection options including networkId, walletUrl, and optional messageToSign
     * @returns A promise that resolves with the connection result, or null if user has rejected the connection
     * @throws Error If the failed to open the wallet popup or already connected
     */
    async requestConnection(options: ConnectionOptions = {}): Promise<ConnectionResult | null> {
        if (this.#connectedAccount !== null) {
            throw new Error('Already connected');
        }

        const {
            networkId = 'mainnet',
            walletUrl = 'https://wallet.intear.tech',
            messageToSign: nep413MessageToSign
        } = options;

        if (nep413MessageToSign && nep413MessageToSign.nonce.length !== 32) {
            throw new Error('Nonce must be 32 bytes');
        }

        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'Ed25519'
            },
            true, // extractable
            ['sign']
        );

        const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const publicKeyBytes = new Uint8Array(publicKeyRaw);
        const publicKeyBase58 = base58Encode(publicKeyBytes);
        const publicKey = `ed25519:${publicKeyBase58}`;

        const origin = window.location.origin;
        let messagePayload: { origin: string; messageToSign?: string };
        if (nep413MessageToSign) {
            const nep413Payload = JSON.stringify({
                message: nep413MessageToSign.message,
                nonce: Array.from(nep413MessageToSign.nonce),
                recipient: nep413MessageToSign.recipient,
                callback_url: nep413MessageToSign.callbackUrl ?? null,
                state: nep413MessageToSign.state ?? null
            });
            messagePayload = { origin, messageToSign: nep413Payload };
        } else {
            messagePayload = { origin };
        }
        const message = JSON.stringify(messagePayload);

        const nonce = Date.now();

        const messageToHash = `${nonce}|${message}`;
        const hashedMessage = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(messageToHash));

        const signatureBuffer = await crypto.subtle.sign(
            {
                name: 'Ed25519'
            },
            keyPair.privateKey,
            hashedMessage
        );

        const signatureBytes = new Uint8Array(signatureBuffer);
        const signatureBase58 = base58Encode(signatureBytes);
        const signature = `ed25519:${signatureBase58}`;

        const signInData = {
            publicKey,
            networkId,
            nonce,
            message,
            signature,
            version: 'V2',
            actualOrigin: origin
        };

        return openPopupFlow<ConnectionResult>({
            path: '/connect',
            walletUrl,
            sendMessageType: 'signIn',
            sendData: signInData,
            successMessageType: 'connected',
            onSuccess: async (data) => {
                if (!data.accounts || data.accounts.length === 0) {
                    throw new Error('No accounts returned from wallet, this should never happen, a bug on wallet side');
                }
                const accountId = data.accounts[0].accountId;
                this.#connectedAccount = new ConnectedAccount(accountId, this);
                const responseWalletUrl = data.walletUrl || walletUrl;
                this.walletUrl = responseWalletUrl;
                const privateKeyJwk = await crypto.subtle.exportKey('jwk', keyPair.privateKey);
                await this.storage.set(STORAGE_KEY_APP_PRIVATE_KEY, privateKeyJwk);
                await this.storage.set(STORAGE_KEY_WALLET_URL, responseWalletUrl);
                await this.storage.set(STORAGE_KEY_ACCOUNT_ID, accountId);

                const result: ConnectionResult = { account: this.#connectedAccount };

                if (nep413MessageToSign) {
                    if (!data.signedMessage) {
                        throw new Error('No signed message returned from wallet, this should never happen, a bug on wallet side');
                    }
                    const signatureWithoutPrefix = data.signedMessage.signature.split(':')[1];
                    const sigBytes = base58Decode(signatureWithoutPrefix);
                    const signatureBase64 = base64Encode(sigBytes);
                    result.signedMessage = {
                        accountId: data.signedMessage.accountId,
                        publicKey: data.signedMessage.publicKey,
                        signature: signatureBase64,
                        state: data.signedMessage.state
                    };
                }

                return result;
            },
            isUserRejection: (msg) => msg === "User rejected the connection"
        });
    }

    /**
     * Disconnects from the Intear Wallet
     * @throws Error If the account is not connected
     */
    async disconnect(): Promise<void> {
        if (this.#connectedAccount !== null) {
            this.#connectedAccount.disconnected = true;
            this.#connectedAccount = null;
            this.walletUrl = undefined;
            await this.storage.remove(STORAGE_KEY_ACCOUNT_ID);
            await this.storage.remove(STORAGE_KEY_APP_PRIVATE_KEY);
            await this.storage.remove(STORAGE_KEY_WALLET_URL);
        } else {
            throw new Error('Account is not connected');
        }
    }
}

/**
 * InMemoryStorage - An in-memory storage implementation that is not persisted
 */
export class InMemoryStorage implements Storage {
    private data: Map<string, any>;

    /**
     * Creates a new, empty InMemoryStorage instance
     */
    constructor() {
        this.data = new Map();
    }

    /**
     * Gets the data stored in the storage
     * @returns The data stored in the storage
     */
    getData(): Map<string, any> {
        return this.data;
    }

    /**
     * Clones the storage
     * @returns A new InMemoryStorage instance with the same data. Modifying
     * the clone will not affect the original storage, and vice versa.
     */
    clone(): InMemoryStorage {
        const clone = new InMemoryStorage();
        clone.data = new Map(this.data);
        return clone;
    }

    get(key: string): Promise<any | null> {
        const value = this.data.get(key);
        return Promise.resolve(value !== undefined ? value : null);
    }

    async set(key: string, value: any): Promise<any | null> {
        const previousValue = await this.get(key);
        this.data.set(key, value);
        return Promise.resolve(previousValue);
    }

    async remove(key: string): Promise<any | null> {
        const previousValue = await this.get(key);
        this.data.delete(key);
        return Promise.resolve(previousValue);
    }
}

/**
 * LocalStorageStorage - A localStorage-backed storage implementation
 */
export class LocalStorageStorage implements Storage {
    private prefix: string;
    private storage: globalThis.Storage;

    /**
     * Creates a new LocalStorageStorage instance
     * @param prefix - The prefix to apply to all keys
     * @param storage - The storage to use for storing the data. You can pass
     * your own localStorage-compatible object, like sessionStorage.
     * @throws Error If localStorage is not available
     */
    constructor(prefix: string, storage: globalThis.Storage = window.localStorage) {
        this.prefix = prefix;
        this.storage = storage;
    }

    /**
     * Prefixes the key and returns the key that corresponds to localStorage
     */
    private _getPrefixedKey(key: string): string {
        return this.prefix + key;
    }

    get(key: string): Promise<any | null> {
        const prefixedKey = this._getPrefixedKey(key);
        const item = this.storage.getItem(prefixedKey);
        return Promise.resolve(item === null ? null : JSON.parse(item));
    }

    async set(key: string, value: any): Promise<any | null> {
        const previousValue = await this.get(key);
        const prefixedKey = this._getPrefixedKey(key);
        this.storage.setItem(prefixedKey, JSON.stringify(value));
        return Promise.resolve(previousValue);
    }

    async remove(key: string): Promise<any | null> {
        const previousValue = await this.get(key);
        const prefixedKey = this._getPrefixedKey(key);
        this.storage.removeItem(prefixedKey);
        return Promise.resolve(previousValue);
    }
}

export default IntearWalletConnector;
