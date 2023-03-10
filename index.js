
// required dom elements
const buttonEl = document.getElementById('button');
const messageEl = document.getElementById('message');
const titleEl = document.getElementById('real-time-title');


// initial states and global variables
messageEl.style.display = 'none';
let isRecording = false;
let socket;
let recorder;
//let arduinoSocket;

// Initialize the firebase database
var firebaseConfig = {
    apiKey: "AIzaSyCFnvtdTVkQZzfvhzOukWH7RpzY7ioen8Y",
    authDomain: "esp32-fb-dfd3a.firebaseapp.com",
    databaseURL: "https://esp32-fb-dfd3a-default-rtdb.firebaseio.com",
    projectId: "esp32-fb-dfd3a",
    storageBucket: "esp32-fb-dfd3a.appspot.com",
    messagingSenderId: "543332848862",
    appId: "1:543332848862:web:c0d022cb4c1667f2241e4f",
    measurementId: "G-RH4LQTG4GN"
};

const firebase = initializeApp(firebaseConfig);


const run = async () => {
    isRecording = !isRecording;
    buttonEl.innerText = isRecording ? 'Stop' : 'Record';
    titleEl.innerText = isRecording ? 'Click stop to end recording!' : 'Click start to begin recording!'

    if (!isRecording) {

      if (recorder) {
        recorder.pauseRecording();
        recorder = null;
      }

      if (socket) {
        socket.send(JSON.stringify({terminate_session: true}));

        socket.close();
        socket = null;
      }

    } else {
            // get session token from backend
        const response = await fetch('https://stp-coral.vercel.app');
        const data = await response.json();

        if(data.error){
            alert(data.error)
        }

        const { token } = data;

        // establish wss with AssemblyAI at 16000 sample rate
        socket = new WebSocket(`wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000&token=${token}`);
        // arduinoSocket = new WebSocket('wss://demo.piesocket.com/v3/channel_123?api_key=VCXCEuvhGcBDP7XhiJJUDvR1e1D3eiVjgZ9VRiaV&notify_self');

        //arduinoSocket = new WebSocket('ws://192.168.1.71');


        // handle incoming messages to display transcription to the DOM
        const texts = {};
        socket.onmessage = (message) => {
            console.log("msg received")
            let msg = '';
            const res = JSON.parse(message.data);
            texts[res.audio_start] = res.text;
            const keys = Object.keys(texts);
            keys.sort((a, b) => a - b);
            for (const key of keys) {
                if (texts[key]) {
                    msg += ` ${texts[key]}`;
                }
            }
            messageEl.innerText = msg;

            var database = firebase.database();

            // Send a message to the database
            var messageRef = database.ref("message");
            messageRef.set("Hello World!");

            // socketio.emit('data', { data: 'hello from JavaScript' });
            // arduinoSocket.onopen = () => arduinoSocket.send(JSON.stringify(msg));
            // arduinoSocket.onopen = function() {
                // console.log("Connected to the websocket server");
            // Send data to the websocket server
                // arduinoSocket.send(JSON.stringify(msg));
            // };
            // arduinoSocket.send(JSON.stringify(msg));

            // if (arduinoSocket){
            //     console.log("connection with arduinoSocket established");
            //     arduinoSocket.send(JSON.stringify(msg));
            // }
        };


        // handle error
        socket.onerror = (event) => {
            console.error(event);
            socket.close();
        }

        // handle socket close
        socket.onclose = event => {
            console.log(event);
            socket = null;
        }

        // handle socket open
        socket.onopen = () => {
            // begin recording
            messageEl.style.display = '';
            navigator.mediaDevices.getUserMedia({ audio: true })
            .then((stream) => {
                recorder = new RecordRTC(stream, {
                type: 'audio',
                mimeType: 'audio/webm;codecs=pcm', // endpoint requires 16bit PCM audio
                recorderType: StereoAudioRecorder,
                timeSlice: 250, // set 250 ms intervals of data
                desiredSampRate: 16000,
                numberOfAudioChannels: 1, // real-time requires only one channel
                bufferSize: 4096,
                audioBitsPerSecond: 128000,
                ondataavailable: (blob) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64data = reader.result;

                        // audio data must be sent as a base64 encoded string
                        if (socket) {
                            socket.send(JSON.stringify({ audio_data: base64data.split('base64,')[1] }));
                        }
                    };
                    reader.readAsDataURL(blob);
                },
            });

            recorder.startRecording();
            })
            .catch((err) => console.error(err));
        };

    }
  };

buttonEl.addEventListener('click', () => run());
