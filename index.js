const webpal = require('webpal')
const express = require('express')
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const app = express();
const port = process.env.PORT || 3000;

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
    let output = fs.createWriteStream('logsWebpal.zip');
    let archive = archiver('zip', {
        zlib: { level: 9 } 
    });

    archive.pipe(output);

    archive.directory('logsWebpal/', false);

    archive.finalize();

    output.on('close', function() {
        console.log(archive.pointer() + ' total bytes');
        console.log('archiver has been finalized and the output file descriptor has closed.');

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

  const logsFolder = 'logsWebpal';
  const logFileName = `${userId}.tsv`;
  const logFilePath = path.join(__dirname, logsFolder, logFileName);

  if (!fs.existsSync(logsFolder)) {
    fs.mkdirSync(logsFolder);
  }

  const logEntry = Object.values(logContent).join('\t');

  const header = 'studentID\texerciseID\ttimestamp\twithFeedback\tfeedback';

  if (fs.existsSync(logFilePath)) {
    fs.appendFile(logFilePath, logEntry + '\n', (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to append log data' });
      } else {
        res.sendStatus(200);
      }
    });
  } else {
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