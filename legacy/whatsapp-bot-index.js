
// Importar as bibliotecas necessárias
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
require('dotenv').config();

// Criar um cliente do WhatsApp com autenticação local
const client = new Client({
    authStrategy: new LocalAuth(),
});

// Gerar o QR Code para conectar com o WhatsApp
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('QR Code gerado, escaneie com o WhatsApp!');
});

// Quando o cliente for autenticado, exibe a mensagem de sucesso
client.on('ready', () => {
    console.log('O WhatsApp Web está pronto e conectado!');
});

// Responder automaticamente quando receber uma mensagem
client.on('message', (message) => {
    console.log(`Mensagem recebida: ${message.body}`);
    message.reply('Olá, estou aqui para ajudar!');
});

// Iniciar o cliente do WhatsApp
client.initialize();
