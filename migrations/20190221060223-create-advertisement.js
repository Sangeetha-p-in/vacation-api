'use strict';
module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable('Advertisements', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      id: {
        type: Sequelize.INTEGER
      },
      title: {
        type: Sequelize.STRING
      },
      description: {
        type: Sequelize.TEXT
      },
      video_thumb: {
        type: Sequelize.TEXT
      },
      video_url: {
        type: Sequelize.TEXT
      },
      target_url: {
        type: Sequelize.TEXT
      },
      provider_name: {
        type: Sequelize.STRING
      },
      amount_paid: {
        type: Sequelize.FLOAT
      },
      max_view: {
        type: Sequelize.INTEGER
      },
      current_view: {
        type: Sequelize.INTEGER
      },
      target_url: {
        type: Sequelize.TEXT
      },
      target_url: {
        type: Sequelize.TEXT
      },
      active: {
        type: Sequelize.ENUM
      },
      created_at: {
        type: Sequelize.DATE
      },
      updated_at: {
        type: Sequelize.DATE
      },
      deleted_at: {
        type: Sequelize.DATE
      },
      skip_add: {
        type: Sequelize.ENUM
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  down: (queryInterface, Sequelize) => {
    return queryInterface.dropTable('Advertisements');
  }
};