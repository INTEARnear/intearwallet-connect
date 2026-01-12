/**
 * Encodes a byte array to base58 string
 * @param bytes - The byte array to encode
 * @returns The base58 encoded string
 */
function base58Encode(bytes) {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let bytesArray;
    if (!(bytes instanceof Uint8Array)) {
        bytesArray = Uint8Array.from(bytes);
    }
    else {
        bytesArray = bytes;
    }
    let zeroCount = 0;
    while (zeroCount < bytesArray.length && bytesArray[zeroCount] === 0) {
        zeroCount++;
    }
    const digits = [];
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
 * ConnectedAccount - A connected Intear Wallet account and its data
 */
class ConnectedAccount {
    accountId;
    disconnected;
    #connector;
    /**
     * @deprecated Don't use this constructor directly, this class should only be instantiated by the connector
     */
    constructor(accountId, connector) {
        this.accountId = accountId;
        this.#connector = connector;
        this.disconnected = false;
    }
    /**
     * Disconnects the account from the connector
     */
    disconnect() {
        this.#connector.disconnect();
    }
}
const STORAGE_KEY_ACCOUNT_ID = 'accountId';
/**
 * IntearWalletConnector - A lightweight connector for Intear Wallet
 */
export class IntearWalletConnector {
    #connectedAccount;
    storage;
    /**
     * Creates a new IntearWalletConnector instance
     * @param storage - The storage to load the connected account from
     * @returns A promise that resolves with the IntearWalletConnector instance
     */
    static async loadFrom(storage) {
        if (!storage) {
            throw new Error('loadFrom: Invalid arguments');
        }
        const accountId = await storage.get(STORAGE_KEY_ACCOUNT_ID);
        const connector = new IntearWalletConnector(storage, null);
        const connectedAccount = accountId ? new ConnectedAccount(accountId, connector) : null;
        connector.#connectedAccount = connectedAccount;
        return connector;
    }
    constructor(storage, connectedAccount) {
        this.storage = storage;
        this.#connectedAccount = connectedAccount;
    }
    /**
     * Gets the currently connected account
     * @returns The connected account object or null if not connected
     */
    get connectedAccount() {
        return this.#connectedAccount;
    }
    /**
     * Requests a connection to the Intear Wallet
     * @param options - Connection options
     * @returns A promise that resolves with the connected account, or null if user has rejected the connection
     * @throws Error If the failed to open the wallet popup or already connected
     */
    async requestConnection(options = {}) {
        if (this.#connectedAccount !== null) {
            throw new Error('Already connected');
        }
        const { walletUrl = 'https://wallet.intear.tech', networkId = 'mainnet', } = options;
        const keyPair = await crypto.subtle.generateKey({
            name: 'Ed25519'
        }, true, // extractable
        ['sign']);
        const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const publicKeyBytes = new Uint8Array(publicKeyRaw);
        const publicKeyBase58 = base58Encode(publicKeyBytes);
        const publicKey = `ed25519:${publicKeyBase58}`;
        const origin = window.location.origin;
        const message = JSON.stringify({ origin });
        const nonce = Date.now();
        const messageToSign = `${nonce}|${message}`;
        const hashedMessage = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(messageToSign));
        const signatureBuffer = await crypto.subtle.sign({
            name: 'Ed25519'
        }, keyPair.privateKey, hashedMessage);
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
        const popup = window.open(`${walletUrl}/connect`, 'IntearWalletConnect', 'width=400,height=700,scrollbars=yes,resizable=yes');
        if (!popup) {
            throw new Error('Failed to open wallet popup.');
        }
        return new Promise((resolve, reject) => {
            let resultReceived = false;
            const cleanup = () => {
                window.removeEventListener('message', messageHandler);
                if (checkClosed) {
                    clearInterval(checkClosed);
                }
            };
            const messageHandler = async (event) => {
                if (event.origin !== walletUrl) {
                    return;
                }
                try {
                    const data = event.data;
                    if (data.type === 'ready') {
                        popup.postMessage({
                            type: 'signIn',
                            data: signInData
                        }, walletUrl);
                    }
                    else if (data.type === 'connected' && !resultReceived) {
                        resultReceived = true;
                        cleanup();
                        popup.close();
                        if (data.accounts && data.accounts.length > 0) {
                            const accountId = data.accounts[0].accountId;
                            this.#connectedAccount = new ConnectedAccount(accountId, this);
                            await this.storage.set(STORAGE_KEY_ACCOUNT_ID, accountId);
                            resolve(this.#connectedAccount);
                        }
                        else {
                            reject(new Error('No accounts returned from wallet, this should never happen, a bug on wallet side'));
                        }
                    }
                    else if (data.type === 'error' && !resultReceived) {
                        resultReceived = true;
                        cleanup();
                        popup.close();
                        if (data.message == "User rejected the connection") {
                            resolve(null);
                        }
                        else {
                            reject(new Error(data.message || 'Connection failed'));
                        }
                    }
                }
                catch (error) {
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
     * Disconnects from the Intear Wallet
     * @throws Error If the account is not connected
     */
    async disconnect() {
        if (this.#connectedAccount !== null) {
            this.#connectedAccount.disconnected = true;
            this.#connectedAccount = null;
            await this.storage.remove(STORAGE_KEY_ACCOUNT_ID);
        }
        else {
            throw new Error('Account is not connected');
        }
    }
}
/**
 * InMemoryStorage - An in-memory storage implementation that is not persisted
 */
export class InMemoryStorage {
    data;
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
    getData() {
        return this.data;
    }
    /**
     * Clones the storage
     * @returns A new InMemoryStorage instance with the same data. Modifying
     * the clone will not affect the original storage, and vice versa.
     */
    clone() {
        const clone = new InMemoryStorage();
        clone.data = new Map(this.data);
        return clone;
    }
    get(key) {
        const value = this.data.get(key);
        return Promise.resolve(value !== undefined ? value : null);
    }
    async set(key, value) {
        const previousValue = await this.get(key);
        this.data.set(key, value);
        return Promise.resolve(previousValue);
    }
    async remove(key) {
        const previousValue = await this.get(key);
        this.data.delete(key);
        return Promise.resolve(previousValue);
    }
}
/**
 * LocalStorageStorage - A localStorage-backed storage implementation
 */
export class LocalStorageStorage {
    prefix;
    storage;
    /**
     * Creates a new LocalStorageStorage instance
     * @param prefix - The prefix to apply to all keys
     * @param storage - The storage to use for storing the data. You can pass
     * your own localStorage-compatible object, like sessionStorage.
     * @throws Error If localStorage is not available
     */
    constructor(prefix, storage = window.localStorage) {
        this.prefix = prefix;
        this.storage = storage;
    }
    /**
     * Prefixes the key and returns the key that corresponds to localStorage
     */
    _getPrefixedKey(key) {
        return this.prefix + key;
    }
    get(key) {
        const prefixedKey = this._getPrefixedKey(key);
        const item = this.storage.getItem(prefixedKey);
        return Promise.resolve(item === null ? null : JSON.parse(item));
    }
    async set(key, value) {
        const previousValue = await this.get(key);
        const prefixedKey = this._getPrefixedKey(key);
        this.storage.setItem(prefixedKey, JSON.stringify(value));
        return Promise.resolve(previousValue);
    }
    async remove(key) {
        const previousValue = await this.get(key);
        const prefixedKey = this._getPrefixedKey(key);
        this.storage.removeItem(prefixedKey);
        return Promise.resolve(previousValue);
    }
}
export default IntearWalletConnector;
