/**
 * Encodes a byte array to base58 string
 * @param {Uint8Array | Iterable<number>} bytes - The bytes to encode
 * @returns {string} The base58 encoded string
 */
function base58Encode(bytes) {
    const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

    if (!(bytes instanceof Uint8Array)) {
        bytes = Uint8Array.from(bytes);
    }

    let zeroCount = 0;
    while (zeroCount < bytes.length && bytes[zeroCount] === 0) {
        zeroCount++;
    }

    const digits = [];
    for (let i = zeroCount; i < bytes.length; i++) {
        let carry = bytes[i];
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
    #connector;

    /**
     * @hideconstructor
     */
    constructor(accountId, connector) {
        this.accountId = accountId;
        this.#connector = connector;
        this.disconnected = false;
    }

    /**
     * Disconnects the account from the connector
     * @returns {void}
     */
    disconnect() {
        this.#connector.disconnect();
    }
}

const STORAGE_KEY_ACCOUNT_ID = 'accountId';

/**
 * IntearWalletConnector - A lightweight connector for Intear Wallet
 */
class IntearWalletConnector {
    #connectedAccount;
    storage;

    /**
     * Creates a new IntearWalletConnector instance
     * @param {Storage} storage - The storage to load the connected account from
     * @returns {Promise<IntearWalletConnector>} A promise that resolves with the IntearWalletConnector instance
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

    /**
     * @hideconstructor
     */
    constructor(storage, connectedAccount) {
        if (!storage) {
            throw new Error('constructor: Invalid arguments. Don\'t use this constructor directly, use loadFrom instead.');
        }
        this.storage = storage;
        this.#connectedAccount = connectedAccount;
    }

    /**
     * Gets the currently connected account
     * @returns {ConnectedAccount|null} The connected account object or null if not connected
     */
    get connectedAccount() {
        return this.#connectedAccount;
    }

    /**
     * Requests a connection to the Intear Wallet
     * @param {Object} options - Connection options
     * @param {string} [options.walletUrl='https://wallet.intear.tech'] - The wallet URL
     * @param {string} [options.networkId='mainnet'] - The network ID (mainnet, testnet, or custom for localnets)
     * @returns {Promise<ConnectedAccount | null>} A promise that resolves with the connected account, or null if user has rejected the connection
     * @throws {Error} If the failed to open the wallet popup or already connected
     */
    async requestConnection(options = {}) {
        if (this.#connectedAccount !== null) {
            throw new Error('Already connected');
        }

        const {
            walletUrl = 'https://wallet.intear.tech',
            networkId = 'mainnet',
        } = options;

        const keyPair = await crypto.subtle.generateKey(
            {
                name: 'Ed25519'
            },
            true, // extractable
            ['sign', 'verify']
        );

        const publicKeyRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey);
        const publicKeyBytes = new Uint8Array(publicKeyRaw);
        const publicKeyBase58 = base58Encode(publicKeyBytes);
        const publicKey = `ed25519:${publicKeyBase58}`;

        if (typeof window === 'undefined') {
            throw new Error('window is not available in this environment');
        }
        const origin = window.origin;
        const message = JSON.stringify({ origin });

        const nonce = Date.now();

        const messageToSign = `${nonce}|${message}`;
        const hashedMessage = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(messageToSign));

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

        const popup = window.open(
            `${walletUrl}/connect`,
            'IntearWalletConnect',
            'width=400,height=700,scrollbars=yes,resizable=yes'
        );

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
                        popup.postMessage(
                            {
                                type: 'signIn',
                                data: signInData
                            },
                            walletUrl
                        );
                    } else if (data.type === 'connected' && !resultReceived) {
                        resultReceived = true;
                        cleanup();
                        popup.close();

                        if (data.accounts && data.accounts.length > 0) {
                            const accountId = data.accounts[0].accountId;
                            this.#connectedAccount = new ConnectedAccount(accountId);
                            await this.storage.set(STORAGE_KEY_ACCOUNT_ID, accountId);
                            resolve(this.#connectedAccount);
                        } else {
                            reject(new Error('No accounts returned from wallet, this should never happen, a bug on wallet side'));
                        }
                    } else if (data.type === 'error' && !resultReceived) {
                        resultReceived = true;
                        cleanup();
                        popup.close();
                        if (data.message == "User rejected the connection") {
                            resolve(null);
                        } else {
                            reject(new Error(data.message || 'Connection failed'));
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
                        resolve(null)
                    }
                }
            }, 100);
        });
    }

    /**
     * Disconnects from the Intear Wallet
     * @returns {Promise<void>}
     * @throws {Error} If the account is not connected
     */
    async disconnect() {
        if (this.#connectedAccount !== null) {
            this.#connectedAccount.disconnected = true;
            this.#connectedAccount = null;
            await this.storage.remove(STORAGE_KEY_ACCOUNT_ID);
        } else {
            throw new Error('Account is not connected');
        }
    }
}

/**
 * Storage - A storage interface
 * @interface
 */
function Storage() { }

/**
 * get - Gets a value from the storage
 * @param {string} key - The key to get the value from
 * @returns {Promise<any | null>} A promise that resolves with the value or null if not found
 */
Storage.prototype.get = function (key) {
    throw new Error('Not implemented');
};

/**
 * set - Sets a value in the storage
 * @param {string} key - The key to set the value to
 * @param {any} value - The value to set
 * @returns {Promise<any | null>} A promise that resolves with the value or null if it didn't exist
 */
Storage.prototype.set = function (key, value) {
    throw new Error('Not implemented');
};

/**
 * remove - Removes a value from the storage
 * @param {string} key - The key to remove the value from
 * @returns {Promise<any | null>} A promise that resolves with the value or null if it didn't exist
 */
Storage.prototype.remove = function (key) {
    throw new Error('Not implemented');
};

/**
 * InMemoryStorage - An in-memory storage implementation
 * @implements {Storage}
 */
class InMemoryStorage {
    /**
     * Creates a new InMemoryStorage instance, which is not persisted anywhere
     * @constructor
     */
    constructor() {
        this.data = new Map();
    }

    get(key) {
        const value = this.data.get(key);
        return Promise.resolve(value !== undefined ? value : null);
    }

    set(key, value) {
        const previousValue = this.get(key);
        this.data.set(key, value);
        return Promise.resolve(previousValue);
    }

    remove(key) {
        const previousValue = this.get(key);
        this.data.delete(key);
        return Promise.resolve(previousValue);
    }
}

/**
 * LocalStorageStorage - A localStorage-based storage implementation with prefix support
 * @implements {Storage}
 */
class LocalStorageStorage {
    /**
     * Creates a new LocalStorageStorage instance
     * @constructor
     * @param {string} prefix - The prefix to apply to all keys
     * @throws {Error} If localStorage is not available
     */
    constructor(prefix) {
        if (typeof localStorage === 'undefined') {
            throw new Error('localStorage is not available in this environment');
        }
        this.prefix = prefix;
        this.storage = localStorage;
    }

    /**
     * Gets the prefixed key
     * @private
     * @param {string} key - The original key
     * @returns {string} The prefixed key
     */
    _getPrefixedKey(key) {
        return this.prefix + key;
    }

    get(key) {
        const prefixedKey = this._getPrefixedKey(key);
        const item = this.storage.getItem(prefixedKey);
        return Promise.resolve(item === null ? null : JSON.parse(item));
    }

    set(key, value) {
        const previousValue = this.get(key);
        const prefixedKey = this._getPrefixedKey(key);
        this.storage.setItem(prefixedKey, JSON.stringify(value));
        return Promise.resolve(previousValue);
    }

    remove(key) {
        const previousValue = this.get(key);
        const prefixedKey = this._getPrefixedKey(key);
        this.storage.removeItem(prefixedKey);
        return Promise.resolve(previousValue);
    }
}











if (typeof module !== 'undefined' && module.exports) {
    module.exports = IntearWalletConnector;
    module.exports.IntearWalletConnector = IntearWalletConnector;
    module.exports.ConnectedAccount = ConnectedAccount;
    module.exports.InMemoryStorage = InMemoryStorage;
    module.exports.LocalStorageStorage = LocalStorageStorage;
}

export default IntearWalletConnector;
export { IntearWalletConnector, ConnectedAccount, InMemoryStorage, LocalStorageStorage };

