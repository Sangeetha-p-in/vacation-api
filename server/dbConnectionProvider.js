let mysql = require('mysql'),
	connectionString = require('./dbConnectionString');


let dbConnectionProvider = {
	getMysqlConnection(){
		var connection = mysql.createConnection(connectionString.dbConnectionString.connection.demo);
		connection.connect((err)=>{
			if(err) throw err;
			console.log("Database connected successfully");
		});
		return connection;
	},
	closeMysqlConnection(currentConnection){
		if(currentConnection)
			currentConnection.end((err)=>{
				if(err) throw err;
				console.log("Database closed successfully");
			});
	}
}

module.exports.dbConnectionProvider = dbConnectionProvider;