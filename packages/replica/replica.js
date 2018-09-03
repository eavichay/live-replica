/**
 * Created by barakedry on 28/04/2018.
 */
'use strict';
// import PatchDiff from '@live-replica/patch-diff';
// import PatcherProxy from '@live-replica/proxy';
// import LiveReplicaConnection from '@live-replica/socket';

const PatchDiff = require('@live-replica/patch-diff');
const PatcherProxy = require('@live-replica/proxy');
const LiveReplicaSocket = require('@live-replica/socket');

let replicaId = 1000;
class Replica extends PatchDiff {

    constructor(remotePath, options = {dataObject: {}}) {

        options = Object.assign({
            readonly: true,
            subscribeRemoteOnCreate: !!options.connection
        }, options);

        super(options.dataObject || {}, options);
        this.remotePath = remotePath;
        this.id = ++replicaId;
        this.proxies = new WeakMap();

        if (!this.options.connectionCallback) {
            this.options.connectionCallback = (result) => {
                if (result.success) {
                    console.info(`live-replica subscribed to remote ${this.options.readonly ? 'readonly': ''} path=${this.remotePath}`);
                } else {
                    console.error(`live-replica failed to subscribe remote ${this.options.readonly ? 'readonly': ''} path=${this.remotePath} reason=${result.reason}`);
                }
            };
        }

        if (this.options.subscribeRemoteOnCreate) {
            this.subscribeRemote(this.options.connection)
        }
    }

    subscribeRemote(connection = this.options.connection, connectionCallback = this.options.connectionCallback) {

        if (!(connection && connection instanceof LiveReplicaSocket)) {
            throw Error('undefined connection or not a LiveReplicaSocket');
        }

        this.connection = connection;
        this._bindToSocket();
        this.connection.send('subscribe', {
            id: this.id,
            path: this.remotePath,
            allowRPC: !this.options.readonly,
            allowWrite: !this.options.readonly
        }, connectionCallback);
    }

    _bindToSocket() {

        this.connection.on(`apply:${this.id}`, (delta) => {
            this.localApply = false;
            this._remoteApply(delta);
        });

        if (this.options.readonly === false) {
            this.subscribe((data) => {

                debugger;
                if (this.localApply) {
                    this.connection.send(`apply:${this.id}`, data);
                }

            });
        }
    }

    _remoteApply() {
        super.apply(...arguments);
    }

    apply() {
        if (this.options.readonly === false) {
            this.localApply = true;
            super.apply(...arguments);
            this.localApply = false;
        }
    }

    unsubscribeRemote() {
        this.connection.send(`unsubscribe:${this.id}`);
    }


    destroy() {

        this.removeAllListeners();
        this.unsubscribeRemote();

    }

    get data() {
        if (!this.proxies.has(this)) {
            const proxy = PatcherProxy.create(this, '', null, this.options.readonly);
            this.proxies.set(this, proxy);
        }
        return this.proxies.get(this);
    }
}

// export default Replica;
module.exports = Replica;