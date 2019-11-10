'use strict'
import 'babel-polyfill'

require('buffer')

import WebBleTransport from '@coolwallets/transport-web-ble'
// import CoolWallet, { generateKeyPair } from '@coolwallets/wallet'
import CoolWalletEth from '@coolwallets/eth'

const appPrivateKey = 'e80a4a1cbdcbe96749b9d9c62883553d30aa84aac792783751117ea6c52a6e3f'
const appId = '50fb246982570ce2198a51cde1f12cbc1e0ef344'

export default class CoolWalletBridge {
  constructor() {
    this.transport = new WebBleTransport()
    this.app = new CoolWalletEth(this.transport, appPrivateKey, appId)
    // this.connected = false
    this.addEventListeners()
  }

  addEventListeners() {
    const coolbitxcard = 'https://antoncoding.github.io'
    if (window.parent !== window) {
      // Open in Iframe
      onmessage = ({ data, source, origin }) => {
        if (data.target && data.target === 'CWS-IFRAME') {
          let fullscreen
          if (source === window.parent) {
            // comes from metaMask
            // dapp
            // console.log({ parent: window.parent }) // global
            // console.log({ origin }) // origin: "chrome-extension://mcahgmiplippbpbhhjdkmoooalmamckm"
            // console.log({ referrer: window.referrer }) // undefined
            // console.log({data})
            fullscreen = window.open(coolbitxcard)
            fullscreen.focus()
            data.target = 'CWS-TAB'
            fullscreen.postMessage(data, '*') // pass to full screen?
          } else if (source === fullscreen) {
            console.log(`source === fullscreen`)
            window.parent.postMessage(data, '*')
          }
        } else {
          console.log(`Ignoreing Message ${JSON.stringify(data)}`)
        }
      }
    } else {
      // full screen or open directly
      onmessage = ({data, source, origin}) => {
        if (data && data.target === 'CWS-TAB') {
          console.log(`got message send to tab!`)
          console.log({source})
          const { action, params } = data
          const replyAction = `${action}-reply`
          switch (action) {
            case 'coolwallet-unlock':
              this.unlock(replyAction, params.hdPath)
              break
            case 'coolwallet-sign-transaction':
              this.signTransaction(replyAction, params.addrIndex, params.tx, params.to)
              break
            case 'coolwallet-sign-personal-message':
              this.signPersonalMessage(replyAction, params.addrIndex, params.message)
              break
          }
        }
      }
      console.log({ opener: window.opener }) // global
      console.log({ referrer: window.referrer }) // undefined
      if (window.referrer === coolbitxcard) {
        const result = prompt('hello cooltibx user, please confirm xyz')
        if (result === true) {
          window.opener.postMessage('signed data from wallet blabla')
          window.opener.focus()
        }
      }
    }
  }

  sendMessageToExtension(msg) {
    console.log(`send message back to parent`)
    window.parent.postMessage(msg, '*')
  }

  async connectWallet() {
    try {
      if (!this.connected) {
        console.log(`try to connect`)
        await this.transport.connect()
        this.connected = true
      }
    } catch (e) {
      console.log('CWS:::CONNECTION ERROR', e)
    }
  }

  cleanUp() {
    this.app = null
  }

  async unlock(replyAction, addIndex) {
    try {
      await this.connectWallet()
      const { parentPublicKey, parentChainCode } = await this.app.getPublicKey(addIndex, true)
      const res = { parentChainCode, parentPublicKey }
      this.sendMessageToExtension({
        action: replyAction,
        success: true,
        payload: res,
      })
    } catch (err) {
      this.sendMessageToExtension({
        action: replyAction,
        success: false,
        payload: { error: err.toString() },
      })
    } finally {
      this.cleanUp()
    }
  }

  async signTransaction(replyAction, hdPath, tx) {
    try {
      await this.connectWallet()
      const res = await this.app.signTransaction(hdPath, tx)
      this.sendMessageToExtension({
        action: replyAction,
        success: true,
        payload: res,
      })
    } catch (err) {
      this.sendMessageToExtension({
        action: replyAction,
        success: false,
        payload: { error: err.toString() },
      })
    } finally {
      this.cleanUp()
    }
  }

  async signPersonalMessage(replyAction, addIndex, message) {
    try {
      await this.connectWallet()
      const res = await this.app.signMessage(message, addIndex)

      this.sendMessageToExtension({
        action: replyAction,
        success: true,
        payload: res,
      })
    } catch (err) {
      this.sendMessageToExtension({
        action: replyAction,
        success: false,
        payload: { error: err.toString() },
      })
    } finally {
      this.cleanUp()
    }
  }
}
