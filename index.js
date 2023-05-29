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

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const exercisesFilePath = path.join(__dirname, 'exercises.json');

async function loadExercisesFromFile() {
  if (fs.existsSync(exercisesFilePath)) {
    const exercisesData = JSON.parse(fs.readFileSync(exercisesFilePath, 'utf8'));
    const exerciseIDsFromFile = exercisesData.map(exercise => exercise.exerciseID);
    const allExercises = await webpal.getAllExercises();
    for (const exercise of exercisesData) {
      const matchingExercise = allExercises.find(ex => ex.exerciseID === exercise.exerciseID);
      if (!matchingExercise) {        
        const newExerciseID = await webpal.createExercise(exercise.code, exercise.tests, exercise.assignment);
        exercise.exerciseID = newExerciseID;
        fs.writeFileSync(exercisesFilePath, JSON.stringify(exercisesData, null, 2), 'utf8');
      }
    }
  }else {
    fs.writeFileSync(exercisesFilePath, '[]', 'utf8');
  }
}

loadExercisesFromFile();

app.post('/createExercise', async (req, res) => {
  const solutionData = req.body;
  const exerciseID = await webpal.createExercise(solutionData.code, solutionData.tests, solutionData.assignment);
  
  const exercisesData = fs.existsSync(exercisesFilePath) ? JSON.parse(fs.readFileSync(exercisesFilePath, 'utf8')) : [];
  exercisesData.push({exerciseID, ...solutionData});
  fs.writeFileSync(exercisesFilePath, JSON.stringify(exercisesData, null, 2), 'utf8');

  res.send(exerciseID);
});

app.post('/deleteExercise', async (req, res) => {
  const id = req.body.id;
  await webpal.deleteExercise(id);
  
  if (fs.existsSync(exercisesFilePath)) {
    let exercisesData = JSON.parse(fs.readFileSync(exercisesFilePath, 'utf8'));
    exercisesData = exercisesData.filter(exercise => exercise.exerciseID !== id);
    fs.writeFileSync(exercisesFilePath, JSON.stringify(exercisesData, null, 2), 'utf8');
  }

  res.status(200).send("Deleted");
});

app.post('/getFullExercise', async (req, res) => {
  const id = req.body.id;
  const exercise = await webpal.getFullExercise(id);
  
  const matchingExercise = global.exercisesData.find(ex => ex.exerciseID === id);

  console.log(matchingExercise)
  
  res.status(200).send({ ...exercise, description: matchingExercise.description });
});

app.post('/', async (req, res) => {
  res.send("Hello World");
});


app.get('/getAllExercises', async (req, res) => {
  const exercises = await webpal.getAllExercises();
  
  const exercisesData = JSON.parse(fs.readFileSync(exercisesFilePath, 'utf8'));
  const descriptions = exercisesData.reduce((acc, exercise) => {
    acc[exercise.exerciseID] = exercise.description;
    return acc;
  }, {});

  const exercisesWithDescriptions = exercises.map(exercise => ({
    ...exercise,
    description: descriptions[exercise.exerciseID] || ''
  }));

  res.json(exercisesWithDescriptions);
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


app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});