#!/usr/bin/env python3
"""Convert CMF (Creative Music File) to WAV using OPL2 emulation.

CMF files are AdLib/OPL2 FM synthesis music files used by the game engine.
This script renders them to 16-bit 44100 Hz WAV files using PyOPL.

Usage:
    python3 re/cmf_to_wav.py re/renders/music/MUSIC29.cmf output.wav
    python3 re/cmf_to_wav.py --all re/renders/music/ re/renders/music_wav/

Requires: pyopl (pip install pyopl)
"""
import array
import os
import struct
import sys
import wave


# OPL2 register mappings for CMF
# CMF MIDI channels 0-8 map to OPL2 melodic voices 0-8
# Each voice uses two operators (modulator + carrier)

# Operator offset table: voice -> (mod_offset, car_offset)
VOICE_TO_OP = [
    (0x00, 0x03), (0x01, 0x04), (0x02, 0x05),
    (0x08, 0x0B), (0x09, 0x0C), (0x0A, 0x0D),
    (0x10, 0x13), (0x11, 0x14), (0x12, 0x15),
]

# Frequency number table (OPL2 F-numbers for each MIDI note within an octave)
FNUMS = [
    0x157, 0x16B, 0x181, 0x198, 0x1B0, 0x1CA,
    0x1E5, 0x202, 0x220, 0x241, 0x263, 0x287,
]

SAMPLE_RATE = 44100


def parse_cmf(data):
    """Parse a CMF file. Returns (header, instruments, music_data)."""
    if data[:4] != b'CTMF':
        raise ValueError("Not a CMF file")

    version = struct.unpack_from('<H', data, 4)[0]
    inst_offset = struct.unpack_from('<H', data, 6)[0]
    music_offset = struct.unpack_from('<H', data, 8)[0]
    ticks_per_quarter = struct.unpack_from('<H', data, 10)[0]
    clock_ticks_per_sec = struct.unpack_from('<H', data, 12)[0]

    if version >= 0x0101:
        inst_count = struct.unpack_from('<H', data, 36)[0]
        basic_tempo = struct.unpack_from('<H', data, 38)[0]
    else:
        inst_count = struct.unpack_from('<H', data, 20)[0]
        basic_tempo = 120

    # Parse instruments (16 bytes each: 11 OPL2 register values + 5 padding)
    instruments = []
    for i in range(inst_count):
        off = inst_offset + i * 16
        inst = data[off:off + 16]
        instruments.append(inst)

    return {
        'version': version,
        'ticks_per_quarter': ticks_per_quarter,
        'clock_ticks_per_sec': clock_ticks_per_sec,
        'basic_tempo': basic_tempo,
        'inst_count': inst_count,
        'instruments': instruments,
        'music_data': data[music_offset:],
    }


def load_instrument(opl, voice, inst_data):
    """Load a CMF instrument into an OPL2 voice."""
    if voice >= 9:
        return
    mod_off, car_off = VOICE_TO_OP[voice]

    # CMF instrument layout (11 bytes of OPL2 register values):
    # 0: mod characteristic (reg 0x20+mod)
    # 1: car characteristic (reg 0x20+car)
    # 2: mod scale/output (reg 0x40+mod)
    # 3: car scale/output (reg 0x40+car)
    # 4: mod attack/decay (reg 0x60+mod)
    # 5: car attack/decay (reg 0x60+car)
    # 6: mod sustain/release (reg 0x80+mod)
    # 7: car sustain/release (reg 0x80+car)
    # 8: mod wave select (reg 0xE0+mod)
    # 9: car wave select (reg 0xE0+car)
    # 10: feedback/connection (reg 0xC0+voice)
    opl.writeReg(0x20 + mod_off, inst_data[0])
    opl.writeReg(0x20 + car_off, inst_data[1])
    opl.writeReg(0x40 + mod_off, inst_data[2])
    opl.writeReg(0x40 + car_off, inst_data[3])
    opl.writeReg(0x60 + mod_off, inst_data[4])
    opl.writeReg(0x60 + car_off, inst_data[5])
    opl.writeReg(0x80 + mod_off, inst_data[6])
    opl.writeReg(0x80 + car_off, inst_data[7])
    opl.writeReg(0xE0 + mod_off, inst_data[8])
    opl.writeReg(0xE0 + car_off, inst_data[9])
    opl.writeReg(0xC0 + voice, inst_data[10])


def note_on(opl, voice, note, velocity):
    """Start a note on an OPL2 voice."""
    if voice >= 9:
        return

    octave = (note // 12) - 1
    if octave < 0:
        octave = 0
    if octave > 7:
        octave = 7
    fnum = FNUMS[note % 12]

    # Set volume (carrier output level) based on velocity
    mod_off, car_off = VOICE_TO_OP[voice]
    # Scale velocity to OPL2 attenuation (0x3F = silent, 0x00 = max)
    atten = 0x3F - (velocity * 0x3F // 127)
    # Preserve key scale bits, set attenuation
    opl.writeReg(0x43 + car_off, atten & 0x3F)

    # Key off first (to retrigger)
    opl.writeReg(0xB0 + voice, 0x00)
    # Set frequency low byte
    opl.writeReg(0xA0 + voice, fnum & 0xFF)
    # Set frequency high byte + octave + key on
    opl.writeReg(0xB0 + voice, 0x20 | ((octave & 7) << 2) | ((fnum >> 8) & 3))


def note_off(opl, voice):
    """Stop a note on an OPL2 voice."""
    if voice >= 9:
        return
    # Read current B0 register value concept — just clear key-on bit
    opl.writeReg(0xB0 + voice, 0x00)


def render_cmf(data, max_seconds=300):
    """Render a CMF file to 16-bit PCM samples."""
    import pyopl

    cmf = parse_cmf(data)
    opl = pyopl.opl(SAMPLE_RATE, 2, 1)  # sample_rate, sample_size (16-bit), channels (mono)

    # Enable waveform select
    opl.writeReg(0x01, 0x20)

    # Track which instrument is loaded per channel
    channel_instrument = [0] * 16

    music = cmf['music_data']
    pos = 0
    ticks_per_sec = cmf['clock_ticks_per_sec']
    if ticks_per_sec == 0:
        ticks_per_sec = 96

    samples_per_tick = SAMPLE_RATE / ticks_per_sec
    all_samples = array.array('h')
    max_samples = max_seconds * SAMPLE_RATE

    while pos < len(music) and len(all_samples) < max_samples:
        # Read MIDI-like event
        # First: variable-length delta time
        delta = 0
        while pos < len(music):
            b = music[pos]
            pos += 1
            delta = (delta << 7) | (b & 0x7F)
            if not (b & 0x80):
                break

        # Generate samples for delta ticks
        if delta > 0:
            num_samples = int(delta * samples_per_tick)
            remaining = num_samples
            while remaining > 0:
                chunk = min(remaining, 512)
                buf = array.array('h', [0] * chunk)
                opl.getSamples(buf)
                all_samples.extend(buf)
                remaining -= chunk

        if pos >= len(music):
            break

        # Read event
        event = music[pos]
        pos += 1

        if event == 0xFF:
            # Meta event
            if pos >= len(music):
                break
            meta_type = music[pos]
            pos += 1
            # Variable length
            length = 0
            while pos < len(music):
                b = music[pos]
                pos += 1
                length = (length << 7) | (b & 0x7F)
                if not (b & 0x80):
                    break
            pos += length  # skip meta data
            if meta_type == 0x2F:
                break  # end of track

        elif (event & 0xF0) == 0xC0:
            # Program change
            channel = event & 0x0F
            if pos < len(music):
                program = music[pos]
                pos += 1
                channel_instrument[channel] = program
                if channel < 9 and program < len(cmf['instruments']):
                    load_instrument(opl, channel, cmf['instruments'][program])

        elif (event & 0xF0) == 0x90:
            # Note on
            channel = event & 0x0F
            if pos + 1 < len(music):
                note = music[pos]
                velocity = music[pos + 1]
                pos += 2
                if velocity == 0:
                    note_off(opl, channel)
                else:
                    note_on(opl, channel, note, velocity)

        elif (event & 0xF0) == 0x80:
            # Note off
            channel = event & 0x0F
            if pos + 1 < len(music):
                pos += 2  # skip note and velocity
                note_off(opl, channel)

        elif (event & 0xF0) == 0xB0:
            # Control change (ignore for basic rendering)
            if pos + 1 < len(music):
                pos += 2

        elif (event & 0xF0) == 0xE0:
            # Pitch bend (ignore)
            if pos + 1 < len(music):
                pos += 2

        elif (event & 0xF0) == 0xD0:
            # Channel pressure (ignore)
            if pos < len(music):
                pos += 1

        elif (event & 0xF0) == 0xA0:
            # Polyphonic aftertouch (ignore)
            if pos + 1 < len(music):
                pos += 2

        else:
            # Unknown event, try to skip gracefully
            pass

    # Add a short tail for release
    remaining = SAMPLE_RATE // 2
    while remaining > 0:
        chunk = min(remaining, 512)
        buf = array.array('h', [0] * chunk)
        opl.getSamples(buf)
        all_samples.extend(buf)
        remaining -= chunk

    return all_samples


def cmf_to_wav(cmf_path, wav_path, max_seconds=300):
    """Convert a CMF file to WAV."""
    with open(cmf_path, 'rb') as f:
        data = f.read()

    samples = render_cmf(data, max_seconds)

    with wave.open(wav_path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)  # 16-bit
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(samples.tobytes())

    duration = len(samples) / SAMPLE_RATE
    print(f"  {os.path.basename(cmf_path)} -> {os.path.basename(wav_path)} ({duration:.1f}s)")


def main():
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    if args[0] == '--all':
        in_dir = args[1]
        out_dir = args[2] if len(args) > 2 else in_dir
        os.makedirs(out_dir, exist_ok=True)
        cmf_files = sorted(f for f in os.listdir(in_dir) if f.upper().endswith('.CMF'))
        for f in cmf_files:
            wav_name = os.path.splitext(f)[0] + '.wav'
            try:
                cmf_to_wav(os.path.join(in_dir, f), os.path.join(out_dir, wav_name))
            except Exception as e:
                print(f"  {f}: ERROR: {e}")
        print(f"\nConverted {len(cmf_files)} CMF files to WAV in {out_dir}")
    else:
        cmf_path = args[0]
        wav_path = args[1] if len(args) > 1 else os.path.splitext(cmf_path)[0] + '.wav'
        cmf_to_wav(cmf_path, wav_path)


if __name__ == '__main__':
    main()
