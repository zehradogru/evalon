import { inflateRawSync } from 'node:zlib'

interface NpyPayload {
    buffer: Buffer
    dataOffset: number
    descr: string
    shape: number[]
}

function findEndOfCentralDirectory(buffer: Buffer): number {
    const signature = 0x06054b50
    const minimumOffset = Math.max(0, buffer.length - 65_557)

    for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
        if (buffer.readUInt32LE(offset) === signature) {
            return offset
        }
    }

    throw new Error('NPZ central directory bulunamadi.')
}

function readZipEntry(buffer: Buffer, entryName: string): Buffer {
    const centralDirectoryOffset = buffer.readUInt32LE(
        findEndOfCentralDirectory(buffer) + 16
    )
    const entryCount = buffer.readUInt16LE(findEndOfCentralDirectory(buffer) + 10)
    let offset = centralDirectoryOffset

    for (let index = 0; index < entryCount; index += 1) {
        if (buffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error('NPZ central directory kaydi okunamadi.')
        }

        const method = buffer.readUInt16LE(offset + 10)
        const compressedSize = buffer.readUInt32LE(offset + 20)
        const fileNameLength = buffer.readUInt16LE(offset + 28)
        const extraLength = buffer.readUInt16LE(offset + 30)
        const commentLength = buffer.readUInt16LE(offset + 32)
        const localHeaderOffset = buffer.readUInt32LE(offset + 42)
        const fileName = buffer
            .subarray(offset + 46, offset + 46 + fileNameLength)
            .toString('utf-8')

        if (fileName === entryName) {
            if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
                throw new Error('NPZ local header okunamadi.')
            }

            const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26)
            const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28)
            const dataStart =
                localHeaderOffset + 30 + localNameLength + localExtraLength
            const compressed = buffer.subarray(
                dataStart,
                dataStart + compressedSize
            )

            if (method === 0) return Buffer.from(compressed)
            if (method === 8) return inflateRawSync(compressed)

            throw new Error(`Desteklenmeyen NPZ compression method: ${method}`)
        }

        offset += 46 + fileNameLength + extraLength + commentLength
    }

    throw new Error(`NPZ entry bulunamadi: ${entryName}`)
}

function parseShape(header: string): number[] {
    const match = header.match(/'shape':\s*\(([^)]*)\)/)
    if (!match) throw new Error('NPY shape okunamadi.')

    return match[1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .map(Number)
}

function parseNpy(buffer: Buffer): NpyPayload {
    if (buffer.toString('latin1', 0, 6) !== '\x93NUMPY') {
        throw new Error('NPY magic header gecersiz.')
    }

    const major = buffer.readUInt8(6)
    const headerLength =
        major === 1 ? buffer.readUInt16LE(8) : buffer.readUInt32LE(8)
    const headerOffset = major === 1 ? 10 : 12
    const header = buffer
        .subarray(headerOffset, headerOffset + headerLength)
        .toString('latin1')
    const descr = header.match(/'descr':\s*'([^']+)'/)?.[1]
    if (!descr) throw new Error('NPY dtype okunamadi.')

    return {
        buffer,
        dataOffset: headerOffset + headerLength,
        descr,
        shape: parseShape(header),
    }
}

export function readNpzNpy(npzBuffer: Buffer, entryName: string): NpyPayload {
    return parseNpy(readZipEntry(npzBuffer, entryName))
}

export function readNpyUnicodeArray(payload: NpyPayload): string[] {
    const width = Number(payload.descr.match(/^<U(\d+)$/)?.[1])
    const length = payload.shape[0] ?? 0
    if (!Number.isFinite(width) || width <= 0) {
        throw new Error(`Desteklenmeyen NPY unicode dtype: ${payload.descr}`)
    }

    const output: string[] = []
    const itemBytes = width * 4

    for (let row = 0; row < length; row += 1) {
        const chars: string[] = []
        const rowOffset = payload.dataOffset + row * itemBytes

        for (let charIndex = 0; charIndex < width; charIndex += 1) {
            const codePoint = payload.buffer.readUInt32LE(rowOffset + charIndex * 4)
            if (codePoint === 0) continue
            chars.push(String.fromCodePoint(codePoint))
        }

        output.push(chars.join('').trim())
    }

    return output
}

export function readNpyNumber(payload: NpyPayload, flatIndex: number): number {
    if (payload.descr === '<f8') {
        return payload.buffer.readDoubleLE(payload.dataOffset + flatIndex * 8)
    }

    if (payload.descr === '<f4') {
        return payload.buffer.readFloatLE(payload.dataOffset + flatIndex * 4)
    }

    throw new Error(`Desteklenmeyen NPY numeric dtype: ${payload.descr}`)
}
