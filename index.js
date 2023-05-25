const webpal = require('webpal')
const express = require('express')
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const port = 8085;

app.use(express.json());
app.use(cors());

app.post('/createExercise', (req, res) => {
    const solutionData = req.body;
    const id = webpal.createExercise(solutionData.code, solutionData.tests, solutionData.assignment);
    res.send(id);
});

app.post('/deleteExercise', (req, res) => {
    const id = req.body.id;
    webpal.deleteExercise(id);
    res.status(200).send("Deleted");
});

app.post('/getFullExercise', (req, res) => {
    const id = req.body.id;
    const exercise = webpal.getFullExercise(id)
    res.status(200).send(exercise);
});

app.get('/getAllExercises', (req, res) => {
    res.json(webpal.getAllExercises());
});

app.post('/evaluateExercise', async (req, res) => {
    const attemptData = req.body;
    const feedback = await webpal.evaluateAttempt(attemptData.id, attemptData.attemptFiles, attemptData.port, attemptData.previousFeedback);
    res.json(feedback);
});

app.post('/evaluateExerciseWithoutStatic', async (req, res) => {
    const attemptData = req.body;
    const feedback = await webpal.evaluateAttemptWithoutStatic(attemptData.id, attemptData.attemptFiles, attemptData.port, attemptData.previousFeedback);
    res.json(feedback);
});

app.get('/downloadLogs', function(req, res) {
    // create a file to stream archive data to.
    let output = fs.createWriteStream('logsWebpal.zip');
    let archive = archiver('zip', {
        zlib: { level: 9 } // Sets the compression level.
    });

    // pipe archive data to the file
    archive.pipe(output);

    // append files from a directory
    archive.directory('logsWebpal/', false);

    // finalize the archive (ie we are done appending files but streams have to finish yet)
    archive.finalize();

    output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');

        //send the .zip
        res.download(__dirname + '/logsWebpal.zip');
    });

    archive.on('error', function(err){
        throw err;
    });
});

app.post('/log', (req, res) => {
  const logData = req.body;
  const userId = logData.userId;
  const logContent = logData.logContent;

  // Define the folder path and log file name
  const logsFolder = 'logsWebpal';
  const logFileName = `${userId}.tsv`;
  const logFilePath = path.join(__dirname, logsFolder, logFileName);

  // Check if the logs folder exists, create it if not
  if (!fs.existsSync(logsFolder)) {
    fs.mkdirSync(logsFolder);
  }

  // Convert logContent to TSV format
  const logEntry = Object.values(logContent).join('\t');

  // Create the header
  const header = 'studentID\texerciseID\ttimestamp\twithFeedback\tfeedback';

  // Check if the log file already exists
  if (fs.existsSync(logFilePath)) {
    // Append the log entry to the existing log file
    fs.appendFile(logFilePath, logEntry + '\n', (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to append log data' });
      } else {
        res.sendStatus(200);
      }
    });
  } else {
    // Create a new file with the header and log entry
    fs.writeFile(logFilePath, header + '\n' + logEntry + '\n', (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to write log data' });
      } else {
        res.sendStatus(200);
      }
    });
  }
});


app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});