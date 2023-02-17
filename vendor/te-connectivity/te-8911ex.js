

function decodeUplink(input) {
  var res=null;
  switch (input.fPort) {
    case 1:
      res=  Decode8911EX(input.bytes); 
      break;
      case 2:
        res= DecodeFwRevision(input.bytes); 
        break;
    default:
      res= {
        errors: ['unknown FPort'],
      };
      break;
  }
  return res;
}

function encodeDownlink(input) {
  var res =null;
  if (input.data.bandwidth!==null && input.data.measInterval!==null)// change dsp settings
  {
    res = {
      // LoRaWAN FPort used for the downlink message
      fPort: 12,
      // Encoded bytes
      bytes: [0x01, input.data.bandwidth>>8,input.data.bandwidth,input.data.measInterval>>8,input.data.measInterval ],
    };
  }
  else // request Fw revision
  {
    res= {    
      fPort: 2,
      // Encoded bytes
      bytes: [0x00 ],
    }
  }
  return res;
}

function decodeDownlink(input) {
  var res =null; 
  switch (input.fPort) {
    case 2:
      res =  {data: {
        fw_rev_request:true
      }}
      break;
    case 12:
      if(input.bytes==5){
        res= {
          // Decoded downlink (must be symmetric with encodeDownlink)
          data: {
            bandwidth: arrayToUint16(input.bytes,1,false),
            measInterval: arrayToUint16(input.bytes,3,false),
          },
          warnings: [ (bandwidth<800 || bandwidth>19200)? 'Bandwidth out of range':null, measInterval<1 || measInterval>1440?'Measurement Interval out of range':null],
        };
        
        
    }
    else
    {
      res = {
        errors: ['invalid length'],
      };
    }
    break;

    default:
      res = {
        errors: ['invalid FPort'],
      };


  }
  return res;
}

function DecodeFwRevision( bytes) {
  return {
    data: {
      fw_rev: arrayToAscii(bytes)
    },
    warnings: [],
    errors: []
  };
}
function Decode8911EX( bytes) {
  var decode={};
  decode.bat = bytes[0];
  decode.peak_nb = bytes[1];
  decode.temp = arrayToUint16(bytes, 2);
  decode.temp = decode.temp == 0x7FFF ? 'err' : ((decode.temp / 10.0) - 100);
  decode.sig_rms =arrayToUint16(bytes, 4) / 1000.0;
  decode.preset = bytes[6];
  decode.devstat = {};
  if (bytes[7] === 0x00) {
      decode.devstat = 'ok';
  }
  else {
      decode.devstat.rotEn = (bitfield(bytes[7], 7) == 1) ? 'enabled' : 'disabled';
      decode.devstat.temp = (bitfield(bytes[7], 6) === 0) ? 'ok' : 'err';
      decode.devstat.acc = (bitfield(bytes[7], 5) === 0) ? 'ok' : 'err';
  }

  decode.peaks = [];
  for (var i = 0; i < decode.peak_nb; i++) {
    var peak = {};
    peak.freq = arrayConverter(bytes, 5 * i + 8, 2);
    peak.mag = arrayConverter(bytes, ((i * 5) + 10), 2) / 1000.0;
    peak.ratio = bytes[i * 5 + 12];
    decode.peaks.push(peak);   
  }
  return {
    data: {
      battery: decode.bat,
      temperature : decode.temp,
      acceleration :   decode.sig_rms
    },
    warnings: [],
    errors: []
  };
}


function bitfield(val, offset) {
  return (val >> offset) & 0x01;
}
function arrayToString(arr, offset = 0, size = arr.length - offset) {
  var text = ''
  text = arr.slice(offset, offset+size).map(byte => byte.toString(16)).join(',');

  return text
}
function arrayToAscii(arr, offset=0, size = arr.length - offset) {
  var text = ''
  for (var i = 0; i < size; i++) {
      text += String.fromCharCode(arr[i + offset]);
  }
  return text
}
function round(value, decimal) {
  return Math.round(value * Math.pow(10, decimal)) / Math.pow(10, decimal);

}
function hexToFloat(hex) {
  var s = hex >> 31 ? -1 : 1;
  var e = (hex >> 23) & 0xFF;
  return s * (hex & 0x7fffff | 0x800000) * 1.0 / Math.pow(2, 23) * Math.pow(2, (e - 127))
}
function arrayToUint32(arr, offset, littleEndian = true) {
  return (arrayConverter(arr, offset, 4, littleEndian, false));
}
function arrayToUint16(arr, offset, littleEndian = true) {
  return (arrayConverter(arr, offset, 2, littleEndian,false));
}
function arrayToInt32(arr, offset, littleEndian = true) {
  return (arrayConverter(arr, offset, 4, littleEndian, true));
}
function arrayToInt16(arr, offset, littleEndian = true) {
  return (arrayConverter(arr, offset, 2, littleEndian, true));
}

function arrayToFloat(arr, offset, littleEndian = true) {
  let view = new DataView(new ArrayBuffer(4));
  for (let i = 0; i < 4; i++) {
      view.setUint8(i, arr[i + offset]);
  }
  return view.getFloat32(0, littleEndian);
}


function arrayConverter(arr, offset, size, littleEndian = true, isSigned = false) {
  var outputval = 0;
  for (var i = 0; i < size; i++) {
      if (littleEndian == false) {
          outputval |= arr[offset + size - i - 1] << (i * 8);
      }
      else {
          outputval |= arr[i + offset] << (i * 8);
      }
  }
  if (isSigned && (Math.pow(2, (size) * 8 - 1) < outputval))
      outputval = outputval - Math.pow(2, size * 8);

  return outputval;
}