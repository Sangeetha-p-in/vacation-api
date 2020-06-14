var dbConnectionString = {

	connection: {
		
		dev:{
			
			host: process.env.HOST,
			
			user: process.env.DB_USER,
			
			password: process.env.DB_PASS,
			
			database: process.env.DATABASE
			
		},
		
		qa:{

			host: process.env.HOST,
			
			user: process.env.DB_USER,
			
			password: process.env.DB_PASS,
			
			database: process.env.DATABASE

		},

		live:{

			host: process.env.HOST,
			
			user: process.env.DB_USER,
			
			password: process.env.DB_PASS,
			
			database: process.env.DATABASE

		},
		demo:{

			host: process.env.LIVE_HOST,
			
			user: process.env.LIVE_DB_USER,
			
			password: process.env.LIVE_DB_PASS,
			
			database: process.env.LIVE_DATABASE

		}
	}
	
}

module.exports.dbConnectionString = dbConnectionString;