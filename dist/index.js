/**
 * ConnectedAccount - A connected Intear Wallet account and its data
 * @class
 */
class ConnectedAccount {
    /**
     * Creates a new ConnectedAccount instance
     * @constructor
     * @param {string} accountId - The account ID
     */
    constructor(accountId) {
        this.accountId = accountId;
    }
}

/**
 * IntearWalletConnector - A lightweight connector for Intear Wallet
 * @class
 */
class IntearWalletConnector {
    #connectedAccount;

    /**
     * Creates a new IntearWalletConnector instance
     * @param {Storage} storage - The storage to load the connected account from
     * @returns {Promise<IntearWalletConnector>} A promise that resolves with the IntearWalletConnector instance
     */
    static loadFrom(storage) {
        return new Promise((resolve, reject) => {
            resolve(new ConnectedAccount('example.intear'));
        });
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
     * @async
     * @returns {Promise<ConnectedAccount>} A promise that resolves with the connected account
     * @throws {Error} If connection fails
     */
    async requestConnection() {
        // TODO: Implement actual wallet connection logic
        // This is a stub implementation
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                // Simulate successful connection
                this.#connectedAccount = new ConnectedAccount('example.intear');
                resolve(this.#connectedAccount);
            }, 100);
        });
    }

    /**
     * Disconnects from the Intear Wallet
     * @returns {void}
     */
    disconnect() {
        this.#connectedAccount = null;
    }
}

/**
 * Storage - A storage interface
 * @interface
 */
function Storage() {}

/**
 * get - Gets a value from the storage
 * @param {string} key - The key to get the value from
 * @returns {Promise<any | null>} A promise that resolves with the value or null if not found
 */
Storage.prototype.get = function(key) {
    throw new Error('Not implemented');
};

/**
 * set - Sets a value in the storage
 * @param {string} key - The key to set the value to
 * @param {any} value - The value to set
 * @returns {Promise<any | null>} A promise that resolves with the value or null if it didn't exist
 */
Storage.prototype.set = function(key, value) {
    throw new Error('Not implemented');
};

/**
 * remove - Removes a value from the storage
 * @param {string} key - The key to remove the value from
 * @returns {Promise<any | null>} A promise that resolves with the value or null if it didn't exist
 */
Storage.prototype.remove = function(key) {
    throw new Error('Not implemented');
};

/**
 * InMemoryStorage - An in-memory storage implementation
 * @class
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
 * @class
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

