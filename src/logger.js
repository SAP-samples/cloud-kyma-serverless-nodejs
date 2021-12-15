const {format, createLogger, transports, transport} = require('winston');
const {combine, timestamp, printf}=format
// const logFormat = printf(({level,message,timestamp,stack})=>{
//     return `${timestamp} ${level}: ${stack || message}`;
// })

const logger = createLogger({
    level: 'info',
    format: combine(
       // format.colorize(),
        timestamp({format:"YYYY:MM:DD HH:mm:ss"}),
        format.errors({stack: true}),
        format.simple()),
    defaultMeta: { service: 'user-service' },
    transports: [
       // new transports.File({ filename: 'error.log', level: 'error' }),
       // new transports.File({ filename: 'combined.log' }),
        new transports.Console()
    ],
  });

  module.exports = logger