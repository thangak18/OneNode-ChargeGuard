// Fail closed on accidental cloud traffic, including telemetry and package downloads.
const net = require('node:net');
const original = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const options = net._normalizeArgs(args)[0];
  if (!options.path && options.host && !['127.0.0.1', 'localhost', '::1'].includes(options.host)) {
    throw new Error(`HTTP fixture forbids non-loopback network host: ${options.host}`);
  }
  return original.apply(this, args);
};
