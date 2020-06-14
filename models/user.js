'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER
    },
    unique_id: DataTypes.STRING,
    user_type: DataTypes.INTEGER,    
    first_name: DataTypes.STRING,
    last_name: DataTypes.STRING,
    email: DataTypes.STRING,
    user_type: DataTypes.INTEGER,    
    password: DataTypes.STRING,
    state_id: DataTypes.INTEGER,
    city: DataTypes.STRING,
    my_dream: DataTypes.TEXT,
    zip_code:DataTypes.STRING,
    country_id: DataTypes.INTEGER,
    dob: DataTypes.DATE,
    facebook_token: DataTypes.STRING,
    google_token: DataTypes.STRING,
    active: DataTypes.ENUM('Y','N'),
    total_point: DataTypes.INTEGER,
    reset_code: DataTypes.STRING,
    last_login: DataTypes.DATE,
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
    deleted_at: DataTypes.DATE,
    ip_addr: DataTypes.STRING,
    email_verified: DataTypes.ENUM('Y','N'),
    image: DataTypes.STRING,



   /* phone_number: DataTypes.STRING,
    description: DataTypes.TEXT,    
    latitude: DataTypes.STRING,
    longitude: DataTypes.STRING,
    notifications: DataTypes.ENUM('Y','N'),
    platform: DataTypes.ENUM('web','ios','android'),
    device_token: DataTypes.STRING,
    user_name: DataTypes.STRING,

    
    otp: DataTypes.STRING,
    token_expiry: DataTypes.DATE,
    

   
    admin_approved: DataTypes.ENUM('Y','N')*/
  }, {
  	tableName: 'user_master',
    underscored: true,
    paranoid: true
  });
  User.associate = function(models) {
    // associations can be defined here
    User.belongsTo(models.States, { foreignKey: 'state_id' });
  };
  return User;
};