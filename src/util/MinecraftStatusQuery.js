
const { default: got } = require('got/dist/source')
const net = require('net')

const timeout = 4

// Proxy server
const SERVER_URL = 'https://minecraft-status-observer.herokuapp.com'

/**
 * Shitty minecraft querying code from mcobserver.com
 */
class MinecraftStatusQuery {
  static readVarInt (buffer, offset) {
    let result = 0
    let shift = 0
    let cursor = offset

    while (true) {
      if (cursor + 1 > buffer.length) {
        throw new Error('Wrong')
      }
      const b = buffer.readUInt8(cursor)
      result |= ((b & 0x7f) << shift) // Add the bits to our number, except MSB
      cursor++
      if (!(b & 0x80)) { // If the MSB is not set, we return the number
        return {
          value: result,
          size: cursor - offset
        }
      }
      shift += 7 // we only have 7 bits, MSB being the return-trigger
      // assert.ok(shift < 64, 'varint is too big') // Make sure our shift don't overflow.
    }
  }

  static writeVarInt (value, buffer, offset) {
    let cursor = 0
    while (value & ~0x7F) {
      buffer[offset + cursor] = (value & 0xFF) | 0x80
      cursor++
      value >>>= 7
    }
    buffer[offset + cursor] = value
    return offset + cursor + 1
  }

  static queryServer (ip, port) {
    return new Promise((resolve, reject) => {
      const start = Date.now()
      let latency = -1
      const client = net.connect(port, ip, () => {
        latency = Math.round(new Date() - start)

        let length = 1 + 5 + 2 + 1
        const lenBuf = []
        const len = Buffer.byteLength(ip)
        const iplenBuf = []
        this.writeVarInt(len, iplenBuf, 0)
        length += iplenBuf.length

        // console.log(len)
        const buf = Buffer.alloc(length + len + this.writeVarInt(length + len, lenBuf, 0))

        let offset = 0
        // console.log(lenBuf)
        for (let i = 0; i < lenBuf.length; i++) { // Write length
          buf.writeUInt8(lenBuf[i], offset++)
        }
        buf.writeUInt8(0, offset++) // Write protocol id

        buf.writeUInt8(255, offset++) // Write version aka -1
        buf.writeUInt8(255, offset++)
        buf.writeUInt8(255, offset++)
        buf.writeUInt8(255, offset++)
        buf.writeUInt8(15, offset++)

        for (let i = 0; i < iplenBuf.length; i++) { // Write string length
          buf.writeUInt8(iplenBuf[i], offset++)
        }

        offset += buf.write(ip, offset, 'utf8') // Write address

        buf.writeUInt16BE(port, offset) // Write port
        offset += 2

        buf.writeUInt8(1, offset) // Write next state
        // console.log(buf)
        client.write(buf)

        client.write(Buffer.from([1, 0x00])) // Send request

        client.end() // end request
      })

      client.setTimeout(timeout * 1000)

      const recieved = []
      client.on('end', () => {
        let index = 0

        const data = Buffer.concat(recieved)
        const size = this.readVarInt(data, index)
        index += size.size
        const packet = this.readVarInt(data, index)

        index += packet.size
        const length = this.readVarInt(data, index)
        index += length.size
        const str = data.toString('utf8', index, index + length.value)

        resolve({
          data: JSON.parse(str),
          latency: latency
        })
        client.end()
      })
      client.on('data', (data) => {
      //   console.log(data.byteLength);

        recieved.push(data)
      })

      client.on('timeout', () => {
        reject(new Error('Timeout'))
        client.end()
      })

      client.on('error', (err) => {
        reject(err)
      })
    })
  }

  static async queryServerProxied (ip, port) {
    const response = await got(SERVER_URL + '/query', {
      searchParams: {
        address: ip,
        port: port
      },
      timeout: 6000,
      retry: 0
    })

    const data = JSON.parse(response.body)

    if (data.error) {
      throw new Error(data.error)
    }

    return {
      data: data.data,
      latency: data.latency
    }
  }
}

module.exports = MinecraftStatusQuery
