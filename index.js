const express = require('express')
const app = express()
const path = require('path');
const pgp = require('pg-promise')();

app.use(express.static(path.join(__dirname, './build')));

app.use(express.json());

app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
    next();
});

app.get('/api/deliverables', (req,res) => {
  db.any('SELECT * FROM "Deliverables"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/deliverable/:id', (req,res) => {

  var requestingID = req.params["id"];

  var requirements = db.any('SELECT * FROM "DeliverableRequirements" WHERE deliverable_id = $1', [requestingID]);

  var tasks = db.any('SELECT * FROM "DeliverableTasks" WHERE deliverable_id = $1', [requestingID]);

  var deliverable = db.any('SELECT * FROM "Deliverables" WHERE id = $1', [requestingID]);

  Promise.all([deliverable,requirements,tasks]).then(responses => {
    var deliverableRows = responses[0];
    var requirementRows = responses[1];
    var taskRows = responses[2];

    console.log(responses);

    var responseObj = {};

    if(deliverableRows.length > 0){
      responseObj = deliverableRows[0];
      responseObj.requirements = [];
      responseObj.tasks = [];

      if(requirementRows.length > 0){
        for(var row of requirementRows){
          responseObj.requirements.push(row.requirement_id);
        }
      }

      if(taskRows.length > 0){
        for(var row of taskRows){
          responseObj.tasks.push(row.task_id);
        }
      }

    }

    res.json({status: 'success', data: responseObj});
  }).catch(error=> {
    res.json({status: 'error', error: error});
  });
});

app.post('/api/deliverable', (req,res) => {
  var json = req.body;

  var name = json.name;
  var description = json.description || "";
  var tasks = json.tasks || [];
  var requirements = json.requirements || [];

  if(!name){
    res.json({status: 'error', error: "No name."});
    return;
  }

  followCreateDeliverable(res, name, description, requirements, tasks);
});

app.delete('/api/deliverable/:id', (req,res) => {
    var requestingID = req.params["id"];

    var deleteDeliverable = db.any('DELETE FROM "Deliverables" WHERE id = $1', [requestingID]);

    var deleteDeliverableRequirements = db.any('DELETE FROM "DeliverableRequirements" WHERE deliverable_id = $1', [requestingID]);

    var deleteDeliverableTasks = db.any('DELETE FROM "DeliverableTasks" WHERE deliverable_id = $1', [requestingID]);

    var deleteComponentDeliverables = db.any('DELETE FROM "ComponentDeliverables" WHERE deliverable_id = $1', [requestingID]);

    var deleteDefectDeliverables = db.any('DELETE FROM "DefectDeliverables" WHERE deliverable_id = $1', [requestingID]);

    Promise.all([deleteDeliverable,deleteDeliverableRequirements,deleteDeliverableTasks,deleteComponentDeliverables,deleteDefectDeliverables]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

app.post('/api/deliverable/:id', (req,res) => {
  var json = req.body;

  console.log("Got: " + JSON.stringify(json));

  var requestingID = req.params["id"];//Updating

  var name = json.name;
  var description = json.description || "";
  var tasks = json.tasks || [];
  var requirements = json.requirements || [];

  if(!name){
    res.json({status: 'error', error: "No name."});
    return;
  }

  var deleteDeliverableRequirements = db.any('DELETE FROM "DeliverableRequirements" WHERE deliverable_id = $1', [requestingID]);

  var deleteDeliverableTasks = db.any('DELETE FROM "DeliverableTasks" WHERE deliverable_id = $1', [requestingID]);

  var deleteComponentDeliverables = db.any('DELETE FROM "ComponentDeliverables" WHERE deliverable_id = $1', [requestingID]);

  var deleteDefectDeliverables = db.any('DELETE FROM "DefectDeliverables" WHERE deliverable_id = $1', [requestingID]);

  Promise.all([deleteDeliverableRequirements,deleteDeliverableTasks,deleteComponentDeliverables,deleteDefectDeliverables]).then(response => {
    followCreateDeliverable(res, name, description, requirements, tasks, requestingID);
  }).catch(error => {
    res.json({status: 'error', error: error});
  });
});

function followCreateDeliverable(res, name, description, requirements, tasks, updateID){

  var insertQuery = 'INSERT INTO "Deliverables"(name,description) VALUES($1,$2) RETURNING id';

  var insertParameters = [name, description];

  var updateQuery = 'UPDATE "Deliverables" SET (name,description) = ($2,$3) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, name, description];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var deliverableID = response[0].id;

    console.log("Created deliverable of ID: " + deliverableID);

    var insertions = [];

    for(var requirementID of requirements){
      insertions.push(db.any('INSERT INTO "DeliverableRequirements"(deliverable_id,requirement_id) VALUES($1,$2)', [deliverableID,requirementID]));
    }

    for(var taskID of tasks){
      insertions.push(db.any('INSERT INTO "DeliverableTasks"(deliverable_id,task_id) VALUES($1,$2)', [deliverableID,taskID]));
    }

    if(insertions.length == 0){
      res.json({status: 'success', data: {id: deliverableID}});
    }else{
      Promise.all(insertions).then(responses => {
        res.json({status: 'success', data: {id: deliverableID}});
      });
    }

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

app.get('/api/tasks', (req,res) => {
  db.any('SELECT * FROM "Tasks"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/task/:id', (req,res) => {

  var requestingID = req.params["id"];

  db.any('SELECT * FROM "Tasks" WHERE id = $1', [requestingID]).then(response => {
      res.json({status: 'success', data: (response.length > 0 ? response[0] : {})});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.post('/api/task', (req,res) => {
  var json = req.body;

  var name = json.name || "";
  var resourceAssigned = json.resourceAssigned || -1;
  var startDate = json.startDate || "";
  var endDate = json.endDate || "";
  var duration = json.duration || "";
  var effort = json.effort || 0;
  var actualStartDate = json.actualStartDate || "";
  var actualEndDate = json.actualEndDate || "";
  var actualDuration = json.actualDuration || "";
  var effortCompleted = json.effortCompleted || 0;

  followCreateTask(res, name, resourceAssigned, startDate, endDate, duration, effort, actualStartDate, actualEndDate, actualDuration, effortCompleted);
});

app.post('/api/task/:id', (req,res) => {
  var json = req.body;
  var requestingID = req.params["id"];

  var name = json.name || "";
  var resourceAssigned = json.resourceAssigned || -1;
  var startDate = json.startDate || "";
  var endDate = json.endDate || "";
  var duration = json.duration || "";
  var effort = json.effort || 0;
  var actualStartDate = json.actualStartDate || "";
  var actualEndDate = json.actualEndDate || "";
  var actualDuration = json.actualDuration || "";
  var effortCompleted = json.effortCompleted || 0;

  var deleteDeliverableTask = db.any('DELETE FROM "DeliverableTasks" WHERE task_id = $1', [requestingID]);
  Promise.all([deleteDeliverableTask]).then(response => {
    followCreateTask(res, name, resourceAssigned, startDate, endDate, duration, effort, actualStartDate, actualEndDate, actualDuration, effortCompleted, requestingID);
  }).catch(error => {
    res.json({status: 'error', error: error});
  });
});

app.delete('/api/task/:id', (req,res) => {
    var requestingID = req.params["id"];

    var deleteTask = db.any('DELETE FROM "Tasks" WHERE id = $1', [requestingID]);
    var deleteDeliverableTask = db.any('DELETE FROM "DeliverableTasks" WHERE task_id = $1', [requestingID]);

    Promise.all([deleteTask, deleteDeliverableTask]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

function followCreateTask(res, name, resourceAssigned, startDate, endDate, duration, effort, actualStartDate, actualEndDate, actualDuration, effortCompleted, updateID){
  var insertQuery = 'INSERT INTO "Tasks"(name,resource_assigned,start_date,end_date,duration,effort,actual_start_date,actual_end_date,actual_duration,effort_completed) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id';

  var insertParameters = [name, resourceAssigned, startDate, endDate, duration, effort, actualStartDate, actualEndDate, actualDuration, effortCompleted];

  var updateQuery = 'UPDATE "Tasks" SET (name,resource_assigned,start_date,end_date,duration,effort,actual_start_date,actual_end_date,actual_duration,effort_completed) = ($2,$3, $4, $5, $6, $7, $8, $9, $10, $11) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, name, resourceAssigned, startDate, endDate, duration, effort, actualStartDate, actualEndDate, actualDuration, effortCompleted];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var taskID = response[0].id;

    console.log("Created task of ID: " + taskID);

    res.json({status: 'success', data: {id: taskID}});

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}


app.get('/api/action-items', (req,res) => {
  db.any('SELECT * FROM "ActionItems"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/action-item/:id', (req,res) => {

  var requestingID = req.params["id"];

  db.any('SELECT * FROM "ActionItems" WHERE id = $1', [requestingID]).then(response => {
      res.json({status: 'success', data: (response.length > 0 ? response[0] : {})});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.post('/api/action-item', (req,res) => {
  var json = req.body;

  var name = json.name || "";
  var description = json.description || "";;
  var status = json.status || "";
  var actualCompletionDate = json.actualCompletionDate || "";
  var expectedCompletionDate = json.expectedCompletionDate || "";
  var dateAssigned = json.dateAssigned || "";
  var dateCreated = json.dateCreated || "";
  var resourceAssigned = json.resourceAssigned || -1;

  followCreateActionItem(res, name, description, status, actualCompletionDate, expectedCompletionDate, dateAssigned, dateCreated, resourceAssigned);
});

app.post('/api/action-item/:id', (req,res) => {
  var requestingID = req.params["id"];
  var json = req.body;

  var name = json.name || "";
  var description = json.description || "";;
  var status = json.status || "";
  var actualCompletionDate = json.actualCompletionDate || "";
  var expectedCompletionDate = json.expectedCompletionDate || "";
  var dateAssigned = json.dateAssigned || "";
  var dateCreated = json.dateCreated || "";
  var resourceAssigned = json.resourceAssigned || -1;

  var deleteIssuesActionItem = db.any('DELETE FROM "IssuesActionItems" WHERE action_id = $1', [requestingID]);
  var deleteRiskActionItem = db.any('DELETE FROM "RiskActionItems" WHERE action_id = $1', [requestingID]);

  Promise.all([deleteIssuesActionItem,deleteRiskActionItem]).then(response => {
    followCreateActionItem(res, name, description, status, actualCompletionDate, expectedCompletionDate, dateAssigned, dateCreated, resourceAssigned, requestingID);
  }).catch(error => {
    res.json({status: 'error', error: error});
  });
});

app.delete('/api/action-item/:id', (req,res) => {
    var requestingID = req.params["id"];

    var deleteActionItem = db.any('DELETE FROM "ActionItems" WHERE id = $1', [requestingID]);
    var deleteIssuesActionItem = db.any('DELETE FROM "IssuesActionItems" WHERE action_id = $1', [requestingID]);
    var deleteRiskActionItem = db.any('DELETE FROM "RiskActionItems" WHERE action_id = $1', [requestingID]);

    Promise.all([deleteActionItem,deleteIssuesActionItem,deleteRiskActionItem]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

function followCreateActionItem(res, name, description, status, actualCompletionDate, expectedCompletionDate, dateAssigned, dateCreated, resourceAssigned, updateID){
  var insertQuery = 'INSERT INTO "ActionItems"(name,description,status,actual_completion_date,expected_completion_date,date_assigned,date_created,resource_assigned) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id';

  var insertParameters = [name, description, status, actualCompletionDate, expectedCompletionDate, dateAssigned, dateCreated, resourceAssigned];

  var updateQuery = 'UPDATE "ActionItems" SET (name,description,status,actual_completion_date,expected_completion_date,date_assigned,date_created,resource_assigned) = ($2,$3, $4, $5, $6, $7, $8, $9) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, name, description, status, actualCompletionDate, expectedCompletionDate, dateAssigned, dateCreated, resourceAssigned];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var taskID = response[0].id;

    console.log("Created action item of ID: " + taskID);

    res.json({status: 'success', data: {id: taskID}});

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

app.get('/api/issues', (req,res) => {
  db.any('SELECT * FROM "Issues"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/issue/:id', (req,res) => {

  var requestingID = req.params["id"];

  var decisions = db.any('SELECT * FROM "IssuesDecisions" WHERE issue_id = $1', [requestingID]);

  var actionItems = db.any('SELECT * FROM "IssuesActionItems" WHERE issue_id = $1', [requestingID]);

  var issue = db.any('SELECT * FROM "Issues" WHERE id = $1', [requestingID]);

  Promise.all([issue,actionItems,decisions]).then(responses => {
    var issueRows = responses[0];
    var actionItemRows = responses[1];
    var decisionRows = responses[2];

    var responseObj = {};

    if(issueRows.length > 0){
      responseObj = issueRows[0];
      responseObj.actionItems = [];
      responseObj.decisions = [];

      if(actionItemRows.length > 0){
        for(var row of actionItemRows){
          responseObj.actionItems.push(row.action_id);
        }
      }

      if(decisionRows.length > 0){
        for(var row of decisionRows){
          responseObj.decisions.push(row.decision_id);
        }
      }
    }

    res.json({status: 'success', data: responseObj});
  }).catch(error=> {
    res.json({status: 'error', error: error});
  });
});

app.post('/api/issue', (req,res) => {
  var json = req.body;

  var name = json.name;
  var updateDate = json.updateDate || "";
  var status = json.status || "";
  var expectedCompletionDate = json.expectedCompletionDate || "";
  var actualCompletionDate = json.actualCompletionDate || "";
  var dateAssigned = json.dateAssigned || "";

  var actionItems = json.actionItems || [];
  var decisions = json.decisions || [];

  if(!name){
    res.json({status: 'error', error: "No name."});
    return;
  }

  followCreateIssue(res, name, updateDate, status, expectedCompletionDate, actualCompletionDate, dateAssigned, actionItems, decisions);
});

app.post('/api/issue/:id', (req,res) => {
  var requestingID = req.params["id"];
  var json = req.body;

  var name = json.name;
  var updateDate = json.updateDate || "";
  var status = json.status || "";
  var expectedCompletionDate = json.expectedCompletionDate || "";
  var actualCompletionDate = json.actualCompletionDate || "";
  var dateAssigned = json.dateAssigned || "";

  var actionItems = json.actionItems || [];
  var decisions = json.decisions || [];

  if(!name){
    res.json({status: 'error', error: "No name."});
    return;
  }

  var deleteIssueAction = db.any('DELETE FROM "IssuesActionItems" WHERE issue_id = $1', [requestingID]);

  var deleteIssueDecision = db.any('DELETE FROM "IssuesDecisions" WHERE issue_id = $1', [requestingID]);

  Promise.all([deleteIssueAction,deleteIssueDecision]).then(response => {
    followCreateIssue(res, name, updateDate, status, expectedCompletionDate, actualCompletionDate, dateAssigned, actionItems, decisions, requestingID);
  }).catch(error => {
    res.json({status: 'error', error: error});
  });

});

app.delete('/api/issue/:id', (req,res) => {
    var requestingID = req.params["id"];

    var deleteIssue = db.any('DELETE FROM "Issues" WHERE id = $1', [requestingID]);

    var deleteIssueAction = db.any('DELETE FROM "IssuesActionItems" WHERE issue_id = $1', [requestingID]);

    var deleteIssueDecision = db.any('DELETE FROM "IssuesDecisions" WHERE issue_id = $1', [requestingID]);

    Promise.all([deleteIssue,deleteIssueAction,deleteIssueDecision]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

function followCreateIssue(res, name, updateDate, status, expectedCompletionDate, actualCompletionDate, dateAssigned, actionItems, decisions, updateID){

  var insertQuery = 'INSERT INTO "Issues"(name,update_date,status,expected_completion_date,actual_completion_date,date_assigned) VALUES($1,$2,$3,$4,$5,$6) RETURNING id';

  var insertParameters = [name, updateDate, status, expectedCompletionDate, actualCompletionDate, dateAssigned];

  var updateQuery = 'UPDATE "Issues" SET (name,update_date,status,expected_completion_date,actual_completion_date,date_assigned) = ($2,$3,$4,$5,$6,$7) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, name, updateDate, status, expectedCompletionDate, actualCompletionDate, dateAssigned];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var issueID = response[0].id;

    console.log("Created issue of ID: " + issueID);

    var insertions = [];

    for(var actionID of actionItems){
      insertions.push(db.any('INSERT INTO "IssuesActionItems"(issue_id,action_id) VALUES($1,$2)', [issueID,actionID]));
    }

    for(var decisionID of decisions){
      insertions.push(db.any('INSERT INTO "IssuesDecisions"(issue_id,decision_id) VALUES($1,$2)', [issueID,decisionID]));
    }

    if(insertions.length == 0){
      res.json({status: 'success', data: {id: issueID}});
    }else{
      Promise.all(insertions).then(responses => {
        res.json({status: 'success', data: {id: issueID}});
      });
    }

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

app.get('/api/decisions', (req,res) => {
  db.any('SELECT * FROM "Decisions"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/decision/:id', (req,res) => {

  var requestingID = req.params["id"];

  db.any('SELECT * FROM "Decisions" WHERE id = $1', [requestingID]).then(response => {
      res.json({status: 'success', data: (response.length > 0 ? response[0] : {})});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.post('/api/decision', (req,res) => {
  var json = req.body;

  var name = json.name || "";
  var description = json.description || "";;
  var priority = json.priority || "";
  var impact = json.impact || "";
  var dateCreated = json.dateCreated || "";
  var dateNeeded = json.dateNeeded || "";
  var dateMade = json.dateMade || "";
  var decisionMaker = json.decisionMaker || -1;
  var expectedCompletionDate = json.expectedCompletionDate || "";
  var actualCompletionDate = json.actualCompletionDate || "";
  var status = json.status || "";

  followCreateDecision(res, name, description, priority, impact, dateCreated, dateNeeded, dateMade, decisionMaker, expectedCompletionDate, actualCompletionDate, status);
});

app.post('/api/decision/:id', (req,res) => {
  var json = req.body;
  var requestingID = req.params["id"];

  var name = json.name || "";
  var description = json.description || "";;
  var priority = json.priority || "";
  var impact = json.impact || "";
  var dateCreated = json.dateCreated || "";
  var dateNeeded = json.dateNeeded || "";
  var dateMade = json.dateMade || "";
  var decisionMaker = json.decisionMaker || -1;
  var expectedCompletionDate = json.expectedCompletionDate || "";
  var actualCompletionDate = json.actualCompletionDate || "";
  var status = json.status || "";

  var deleteDecisionIssue = db.any('DELETE FROM "IssuesDecisions" WHERE decision_id = $1', [requestingID]);

  Promise.all([deleteDecisionIssue]).then(response => {
    followCreateDecision(res, name, description, priority, impact, dateCreated, dateNeeded, dateMade, decisionMaker, expectedCompletionDate, actualCompletionDate, status, requestingID);
  }).catch(error => {
    res.json({status: 'error', error: error});
  });
});

app.delete('/api/decision/:id', (req,res) => {
    var requestingID = req.params["id"];

    var deleteDecision = db.any('DELETE FROM "Decisions" WHERE id = $1', [requestingID]);

    var deleteDecisionIssue = db.any('DELETE FROM "IssuesDecisions" WHERE decision_id = $1', [requestingID]);

    Promise.all([deleteDecision,deleteDecisionIssue]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

function followCreateDecision(res, name, description, priority, impact, dateCreated, dateNeeded, dateMade, decisionMaker, expectedCompletionDate, actualCompletionDate, status, updateID){
  var insertQuery = 'INSERT INTO "Decisions"(name,description,priority,impact,date_created,date_needed,date_made,decision_maker,expected_completion_date,actual_completion_date,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id';

  var insertParameters = [name, description, priority, impact, dateCreated, dateNeeded, dateMade, decisionMaker, expectedCompletionDate, actualCompletionDate, status];

  var updateQuery = 'UPDATE "Decisions" SET (name,description,priority,impact,date_created,date_needed,date_made,decision_maker,expected_completion_date,actual_completion_date,status) = ($2,$3, $4, $5, $6, $7, $8, $9, $10, $11, $12) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, name, description, priority, impact, dateCreated, dateNeeded, dateMade, decisionMaker, expectedCompletionDate, actualCompletionDate, status];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var decisionID = response[0].id;

    console.log("Created decision of ID: " + decisionID);

    res.json({status: 'success', data: {id: decisionID}});

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

app.get('/api/resources', (req,res) => {
  db.any('SELECT * FROM "Resources"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/resource/:id', (req,res) => {

  var requestingID = req.params["id"];

  db.any('SELECT * FROM "Resources" WHERE id = $1', [requestingID]).then(response => {
      res.json({status: 'success', data: (response.length > 0 ? response[0] : {})});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.post('/api/resource', (req,res) => {
  var json = req.body;

  var name = json.name || "";
  var title = json.title || "";;
  var payRate = json.payRate || 0.0;
  var availability = json.availability || "";

  followCreateResource(res, name, title, payRate, availability);
});

app.post('/api/resource/:id', (req,res) => {
  var json = req.body;
  var requestingID = req.params["id"];

  var name = json.name || "";
  var title = json.title || "";;
  var payRate = json.payRate || 0.0;
  var availability = json.availability || "";

  followCreateResource(res, name, title, payRate, availability, requestingID);
});

app.delete('/api/resource/:id', (req,res) => {
    var requestingID = req.params["id"];

    db.any('DELETE FROM "Resources" WHERE id = $1', [requestingID]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

function followCreateResource(res, name, title, payRate, availability, updateID){
  var insertQuery = 'INSERT INTO "Resources"(name,title,pay_rate,availability) VALUES($1,$2,$3,$4) RETURNING id';

  var insertParameters = [name, title, payRate, availability];

  var updateQuery = 'UPDATE "Resources" SET (name,title,pay_rate,availability) = ($2,$3, $4, $5) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, name, title, payRate, availability];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var resourceID = response[0].id;

    console.log("Created resource item of ID: " + resourceID);

    res.json({status: 'success', data: {id: resourceID}});

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

app.get('/api/risks', (req,res) => {
  db.any('SELECT * FROM "Risks"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/risk/:id', (req,res) => {
  var requestingID = req.params["id"];

  var actionItems = db.any('SELECT * FROM "RiskActionItems" WHERE risk_id = $1', [requestingID]);

  var risk = db.any('SELECT * FROM "Risks" WHERE id = $1', [requestingID]);

  Promise.all([risk,actionItems]).then(responses => {
    var riskRows = responses[0];
    var actionItemRows = responses[1];
    var responseObj = {};

    if(riskRows.length > 0){
      responseObj = riskRows[0];
      responseObj.actionItems = [];

      if(actionItemRows.length > 0){
        for(var row of actionItemRows){
          responseObj.actionItems.push(row.action_id);
        }
      }
    }

    res.json({status: 'success', data: responseObj});
  }).catch(error=> {
    res.json({status: 'error', error: error});
  });
});

app.post('/api/risk', (req,res) => {
  var json = req.body;

  var category = json.category | "";
  var name = json.name || "";
  var probability = json.probability || 0.0;
  var impact = json.impact || "";
  var mitigation = json.mitigation || "";
  var contingency = json.contingency || "";
  var riskScore = json.riskScore || 0.0;
  var actionBy = json.actionBy || "";

  var actionItems = json.actionItems || [];

  followCreateRisk(res, category, name, probability, impact, mitigation, contingency, riskScore, actionBy, actionItems);
});

app.post('/api/risk/:id', (req,res) => {
  var json = req.body;
  var requestingID = req.params["id"];

  var category = json.category || "";
  var name = json.name || "";
  var probability = json.probability || 0.0;
  var impact = json.impact || "";
  var mitigation = json.mitigation || "";
  var contingency = json.contingency || "";
  var riskScore = json.riskScore || 0.0;
  var actionBy = json.actionBy || "";

  var actionItems = json.actionItems || [];

  var deleteRiskActionItems = db.any('DELETE FROM "RiskActionItems" WHERE risk_id = $1', [requestingID]);

  Promise.all([deleteRiskActionItems]).then(response => {
    followCreateRisk(res, category, name, probability, impact, mitigation, contingency, riskScore, actionBy, actionItems, requestingID);
  }).catch(error => {
    res.json({status: 'error', error: error});
  });

});

app.delete('/api/risk/:id', (req,res) => {
    var requestingID = req.params["id"];

    var deleteRisk = db.any('DELETE FROM "Risks" WHERE id = $1', [requestingID]);
    var deleteRiskActionItems = db.any('DELETE FROM "RiskActionItems" WHERE risk_id = $1', [requestingID]);

    Promise.all([deleteRisk, deleteRiskActionItems]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

function followCreateRisk(res, category, name, probability, impact, mitigation, contingency, riskScore, actionBy, actionItems, updateID){
  var insertQuery = 'INSERT INTO "Risks"(category,name,probability,impact,mitigation,contingency,risk_score,action_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id';

  var insertParameters = [category, name, probability, impact, mitigation, contingency, riskScore, actionBy];

  var updateQuery = 'UPDATE "Risks" SET (category,name,probability,impact,mitigation,contingency,risk_score,action_by) = ($2,$3,$4,$5,$6,$7,$8,$9) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, category, name, probability, impact, mitigation, contingency, riskScore, actionBy];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var riskID = response[0].id;

    console.log("Created risk of ID: " + riskID);

    var insertions = [];

    for(var actionID of actionItems){
      insertions.push(db.any('INSERT INTO "RiskActionItems"(risk_id,action_id) VALUES($1,$2)', [riskID,actionID]));
    }

    if(insertions.length == 0){
      res.json({status: 'success', data: {id: riskID}});
    }else{
      Promise.all(insertions).then(responses => {
        res.json({status: 'success', data: {id: riskID}});
      });
    }

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

app.get('/api/requirements', (req,res) => {
  db.any('SELECT * FROM "Requirements"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/requirement/:id', (req,res) => {

  var requestingID = req.params["id"];

  db.any('SELECT * FROM "Requirements" WHERE id = $1', [requestingID]).then(response => {
      res.json({status: 'success', data: (response.length > 0 ? response[0] : {})});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.post('/api/requirement', (req,res) => {
  var json = req.body;

  var name = json.name || "";
  var text = json.text || "";;
  var sourceDocument = json.sourceDocument || "";
  var clientReference = json.clientReference || "";

  followCreateRequirement(res, name, text, sourceDocument, clientReference);
});

app.post('/api/requirement/:id', (req,res) => {
  var json = req.body;
  var requestingID = req.params["id"];

  var name = json.name || "";
  var text = json.text || "";;
  var sourceDocument = json.sourceDocument || "";
  var clientReference = json.clientReference || "";

  var deleteRequirementDeliverable = db.any('DELETE FROM "DeliverableRequirements" WHERE requirement_id = $1', [requestingID]);

  Promise.all([deleteRequirementDeliverable]).then(response => {
    followCreateRequirement(res, name, text, sourceDocument, clientReference, requestingID);
  }).catch(error => {
    res.json({status: 'error', error: error});
  });
});

app.delete('/api/requirement/:id', (req,res) => {
    var requestingID = req.params["id"];

    var deleteRequirement = db.any('DELETE FROM "Requirements" WHERE id = $1', [requestingID]);

    var deleteRequirementDeliverable = db.any('DELETE FROM "DeliverableRequirements" WHERE requirement_id = $1', [requestingID]);

    Promise.all([deleteRequirement, deleteRequirementDeliverable]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

function followCreateRequirement(res, name, text, sourceDocument, clientReference, updateID){
  var insertQuery = 'INSERT INTO "Requirements"(name,text,source_document,client_reference) VALUES($1,$2,$3,$4) RETURNING id';

  var insertParameters = [name, text, sourceDocument, clientReference];

  var updateQuery = 'UPDATE "Requirements" SET (name,text,source_document,client_reference) = ($2,$3, $4, $5) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, name, text, sourceDocument, clientReference];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var requirementID = response[0].id;

    console.log("Created requirement of ID: " + requirementID);

    res.json({status: 'success', data: {id: requirementID}});

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

app.get('/api/changes', (req,res) => {
  db.any('SELECT * FROM "Changes"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/change/:id', (req,res) => {

  var requestingID = req.params["id"];

  db.any('SELECT * FROM "Changes" WHERE id = $1', [requestingID]).then(response => {
      res.json({status: 'success', data: (response.length > 0 ? response[0] : {})});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.post('/api/change', (req,res) => {
  var json = req.body;

  var name = json.name || "";
  var dateRequested = json.dateRequested || "";;
  var requestor = json.requestor || "";
  var status = json.status || "";
  var updateDate = json.updateDate || "";

  followCreateChange(res, name, dateRequested, requestor, status, updateDate);
});

app.delete('/api/change/:id', (req,res) => {
    var requestingID = req.params["id"];

    db.any('DELETE FROM "Changes" WHERE id = $1', [requestingID]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

app.post('/api/change/:id', (req,res) => {
  var json = req.body;
  var requestingID = req.params["id"];

  var name = json.name || "";
  var dateRequested = json.dateRequested || "";;
  var requestor = json.requestor || "";
  var status = json.status || "";
  var updateDate = json.updateDate || "";

  followCreateChange(res, name, dateRequested, requestor, status, updateDate, requestingID);
});

function followCreateChange(res, name, dateRequested, requestor, status, updateDate, updateID){
  var insertQuery = 'INSERT INTO "Changes"(name,date_requested,requestor,status,update_date) VALUES($1,$2,$3,$4,$5) RETURNING id';

  var insertParameters = [name, dateRequested, requestor, status, updateDate];

  var updateQuery = 'UPDATE "Changes" SET (name,date_requested,requestor,status,update_date) = ($2,$3, $4, $5,$6) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, name, dateRequested, requestor, status, updateDate];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var changeID = response[0].id;

    console.log("Created change of ID: " + changeID);

    res.json({status: 'success', data: {id: changeID}});

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

app.get('/api/components', (req,res) => {
  db.any('SELECT * FROM "Components"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/component/:id', (req,res) => {
  var requestingID = req.params["id"];

  var deliverables = db.any('SELECT * FROM "ComponentDeliverables" WHERE component_id = $1', [requestingID]);

  var component = db.any('SELECT * FROM "Components" WHERE id = $1', [requestingID]);

  Promise.all([component,deliverables]).then(responses => {
    var componentRows = responses[0];
    var deliverableRows = responses[1];
    var responseObj = {};

    if(componentRows.length > 0){
      responseObj = componentRows[0];
      responseObj.deliverables = [];

      if(deliverableRows.length > 0){
        for(var row of deliverableRows){
          responseObj.deliverables.push(row.deliverable_id);
        }
      }
    }

    res.json({status: 'success', data: responseObj});
  }).catch(error=> {
    res.json({status: 'error', error: error});
  });
});

app.post('/api/component', (req,res) => {
  var json = req.body;

  var name = json.name || "";

  var deliverables = json.deliverables || [];

  followCreateComponent(res, name, deliverables);
});

app.post('/api/component/:id', (req,res) => {
  var json = req.body;
  var requestingID = req.params["id"];

  var name = json.name || "";

  var deliverables = json.deliverables || [];

  var deleteComponentDeliverables = db.any('DELETE FROM "ComponentDeliverables" WHERE component_id = $1', [requestingID]);

  var deleteComponentDefect = db.any('DELETE FROM "DefectComponents" WHERE component_id = $1', [requestingID]);

  Promise.all([deleteComponentDeliverables,deleteComponentDefect]).then(response => {
    followCreateComponent(res, name, deliverables, requestingID);
  }).catch(error => {
    res.json({status: 'error', error: error});
  });
});

app.delete('/api/component/:id', (req,res) => {
    var requestingID = req.params["id"];

    var deleteComponent = db.any('DELETE FROM "Components" WHERE id = $1', [requestingID]);

    var deleteComponentDeliverables = db.any('DELETE FROM "ComponentDeliverables" WHERE component_id = $1', [requestingID]);

    var deleteComponentDefect = db.any('DELETE FROM "DefectComponents" WHERE component_id = $1', [requestingID]);

    Promise.all([deleteComponent,deleteComponentDeliverables,deleteComponentDefect]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

function followCreateComponent(res, name, deliverables, updateID){
  var insertQuery = 'INSERT INTO "Components"(name) VALUES($1) RETURNING id';

  var insertParameters = [name];

  var updateQuery = 'UPDATE "Components" SET name = $2 WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID, name];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var componentID = response[0].id;

    console.log("Created change of ID: " + componentID);

    var insertions = [];

    for(var deliverableID of deliverables){
      insertions.push(db.any('INSERT INTO "ComponentDeliverables"(component_id,deliverable_id) VALUES($1,$2)', [componentID,deliverableID]));
    }

    if(insertions.length == 0){
      res.json({status: 'success', data: {id: componentID}});
    }else{
      Promise.all(insertions).then(responses => {
        res.json({status: 'success', data: {id: componentID}});
      });
    }

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

app.get('/api/defects', (req,res) => {
  db.any('SELECT * FROM "Defects"').then(response => {
      res.json({status: 'success', data: response});
  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
});

app.get('/api/defect/:id', (req,res) => {

  var requestingID = req.params["id"];

  var components = db.any('SELECT * FROM "DefectComponents" WHERE defect_id = $1', [requestingID]);

  var deliverables = db.any('SELECT * FROM "DefectDeliverables" WHERE defect_id = $1', [requestingID]);

  var defect = db.any('SELECT * FROM "Defects" WHERE id = $1', [requestingID]);

  Promise.all([defect,components,deliverables]).then(responses => {
    var defectRows = responses[0];
    var componentRows = responses[1];
    var deliverableRows = responses[2];

    var responseObj = {};

    if(defectRows.length > 0){
      responseObj = defectRows[0];
      responseObj.components = [];
      responseObj.deliverables = [];

      if(componentRows.length > 0){
        for(var row of componentRows){
          responseObj.components.push(row.component_id);
        }
      }

      if(deliverableRows.length > 0){
        for(var row of deliverableRows){
          responseObj.deliverables.push(row.deliverable_id);
        }
      }
    }

    res.json({status: 'success', data: responseObj});
  }).catch(error=> {
    res.json({status: 'error', error: error});
  });
});

app.post('/api/defect', (req,res) => {
  var json = req.body;

  var name = json.name;
  var description = json.description || "";
  var priority = json.priority || "";
  var severity = json.severity || "";
  var dateRaised = json.dateRaised || "";
  var dateAssigned = json.dateAssigned || "";
  var expectedCompletionDate = json.expectedCompletionDate || "";
  var status = json.status || "";
  var statusDescription = json.statusDescription || "";
  var updateDate = json.updateDate || "";

  var components = json.components || [];
  var deliverables = json.deliverables || [];

  if(!name){
    res.json({status: 'error', error: "No name."});
    return;
  }

  followCreateDefect(res,name,description,priority,severity,dateRaised,dateAssigned,expectedCompletionDate,status,statusDescription,updateDate,components,deliverables);
});

app.post('/api/defect/:id', (req,res) => {
  var json = req.body;
  var requestingID = req.params["id"];

  var name = json.name;
  var description = json.description || "";
  var priority = json.priority || "";
  var severity = json.severity || "";
  var dateRaised = json.dateRaised || "";
  var dateAssigned = json.dateAssigned || "";
  var expectedCompletionDate = json.expectedCompletionDate || "";
  var status = json.status || "";
  var statusDescription = json.statusDescription || "";
  var updateDate = json.updateDate || "";

  var components = json.components || [];
  var deliverables = json.deliverables || [];

  if(!name){
    res.json({status: 'error', error: "No name."});
    return;
  }

  var deleteDefectComponents = db.any('DELETE FROM "DefectComponents" WHERE defect_id = $1', [requestingID]);

  var deleteDefectDeliverables = db.any('DELETE FROM "DefectDeliverables" WHERE defect_id = $1', [requestingID]);

  Promise.all([deleteDefectComponents,deleteDefectDeliverables]).then(response => {
    followCreateDefect(res,name,description,priority,severity,dateRaised,dateAssigned,expectedCompletionDate,status,statusDescription,updateDate,components,deliverables,requestingID);
  }).catch(error => {
    res.json({status: 'error', error: error});
  });
});

app.delete('/api/defect/:id', (req,res) => {
    var requestingID = req.params["id"];

    var deleteDefect = db.any('DELETE FROM "Defects" WHERE id = $1', [requestingID]);

    var deleteDefectComponents = db.any('DELETE FROM "DefectComponents" WHERE defect_id = $1', [requestingID]);

    var deleteDefectDeliverables = db.any('DELETE FROM "DefectDeliverables" WHERE defect_id = $1', [requestingID]);

    Promise.all([deleteDefect,deleteDefectComponents,deleteDefectDeliverables]).then(response => {
      res.json({status: 'success', data: {}});
    }).catch(error => {
      res.json({status: 'error', error: error});
    });
});

function followCreateDefect(res,name,description,priority,severity,dateRaised,dateAssigned,expectedCompletionDate,status,statusDescription,updateDate,components,deliverables,updateID){
  var insertQuery = 'INSERT INTO "Defects"(name,description,priority,severity,date_raised,date_assigned,expected_completion_date,status,status_description,update_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id';

  var insertParameters = [name,description,priority,severity,dateRaised,dateAssigned,expectedCompletionDate,status,statusDescription,updateDate];

  var updateQuery = 'UPDATE "Defects" SET (name,description,priority,severity,date_raised,date_assigned,expected_completion_date,status,status_description,update_date) = ($2,$3,$4,$5,$6,$7,$8,$9,$10,$11) WHERE id = $1 RETURNING id';

  var updatedParameters = [updateID,name,description,priority,severity,dateRaised,dateAssigned,expectedCompletionDate,status,statusDescription,updateDate];

  var properQuery = updateID == null ? db.any(insertQuery, insertParameters) : db.any(updateQuery, updatedParameters);
  properQuery.then(response => {
    var defectID = response[0].id;

    console.log("Created defect of ID: " + defectID);

    var insertions = [];

    for(var componentID of components){
      insertions.push(db.any('INSERT INTO "DefectComponents"(defect_id,component_id) VALUES($1,$2)', [defectID,componentID]));
    }

    for(var deliverableID of deliverables){
      insertions.push(db.any('INSERT INTO "DefectDeliverables"(defect_id,deliverable_id) VALUES($1,$2)', [defectID,deliverableID]));
    }

    if(insertions.length == 0){
      res.json({status: 'success', data: {id: defectID}});
    }else{
      Promise.all(insertions).then(responses => {
        res.json({status: 'success', data: {id: defectID}});
      });
    }

  }).catch(error =>{
    res.json({status: 'error', error: error});
  });
}

const port = 80;

const client = {
  host: 'localhost',
  port: 5432,
  database: 'proj',
  user: '',
  password: '',
  max: 30
};

const db = pgp(client);

app.get('*', (req,res) =>{
    res.sendFile(path.join(__dirname+'/build/index.html'));
});

app.listen(port, () => {
  console.log("Project running on port " + port);
});
