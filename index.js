const {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
} = require("@aws-sdk/client-transcribe-streaming");

const { createReadStream } = require("fs");
const { join } = require("path");
const fs = require("fs");

const { PassThrough } = require("stream");
const readline = require("readline");
const credentials = {
  accessKeyId: "",
  secretAccessKey: "",
};
// Function to log with updating the same line
function logUpdate(message) {
  // Clear the current line
  readline.clearLine(process.stdout, 0);
  // Move the cursor to the beginning of the line
  readline.cursorTo(process.stdout, 0);
  // Write the new message
  process.stdout.write(message);
}

const audioSource = createReadStream(join(__dirname, "recording.flac"));
const audioPayloadStream = new PassThrough({ highWaterMark: 4 * 1024 }); // Stream chunk less than 1 KB
audioSource.pipe(audioPayloadStream);

// const audio = createReadStream(join(__dirname, "recording.wav"), { highWaterMark: 1024 * 16 });

const LanguageCode = "en-US";
const MediaEncoding = "flac";
const MediaSampleRateHertz = 44100;

async function startRequest() {
  const client = new TranscribeStreamingClient({
    region: "us-east-1",
    credentials,
  });

  const params = {
    LanguageCode,
    MediaEncoding,
    MediaSampleRateHertz,
    AudioStream: (async function* () {
      for await (const chunk of audioPayloadStream) {
        console.log("\n1");
        yield { AudioEvent: { AudioChunk: chunk } };
      }
    })(),
  };
  console.log("\n2");
  const command = new StartStreamTranscriptionCommand(params);
  console.log("\n3");
  // Send transcription request
  const response = await client.send(command);
  console.log("\n4");
  // Start to print response
  try {
    a = [];
    transcript = "";
    permanentMessage = "";
    tempMsg = "";
    for await (const event of response.TranscriptResultStream) {
      console.log("\n5");
      tempMsg = "";
      if (event.TranscriptEvent.Transcript.Results.length) {
        a.push(event);
      }
      if (event.TranscriptEvent.Transcript.Results.length) {
        if (event.TranscriptEvent.Transcript.Results[0].IsPartial == false) {
          permanentMessage +=
            event.TranscriptEvent.Transcript.Results[0].Alternatives[0].Transcript;
          tempMsg = "";
        } else {
          tempMsg = event.TranscriptEvent.Transcript.Results[0].Alternatives[0].Transcript;
        }
        logUpdate(permanentMessage + tempMsg);
        // console.log("\n", event.TranscriptEvent.Transcript.Results[0].Alternatives[0].Transcript);
      }
      if (event.TranscriptEvent) {
        const message = event.TranscriptEvent;
        // Get multiple possible results
        const results = event.TranscriptEvent.Transcript.Results;
        // Print all the possible transcripts
        results.map((result) => {
          (result.Alternatives || []).map((alternative) => {
            transcript += alternative.Items.map((item) => item.Content).join(" ");
            // console.log(transcript);
          });
        });
      }
    }
    console.log("\n");
    fs.writeFileSync("content.txt", JSON.stringify(transcript));
    fs.writeFileSync("transcribed.json", JSON.stringify(a));
  } catch (err) {
    console.log("error");
    console.log(err);
  }
}

startRequest();
