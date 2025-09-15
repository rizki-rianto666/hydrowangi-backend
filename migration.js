// migration.js - Script to migrate existing planted data to dual plant system

const mongoose = require('mongoose');
const Planted = require('./models/Planted'); // Adjust path as needed

async function migrateToDualPlantSystem() {
    try {
        console.log('Starting migration to dual plant system...');
        
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://rizki123:s4s4g3y0@cluster0.guinnfo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        
        // Find all existing planted records without slot
        const existingPlants = await Planted.find({ 
            $or: [
                { slot: { $exists: false } },
                { slot: null }
            ]
        });
        
        console.log(`Found ${existingPlants.length} plants to migrate`);
        
        // Assign slots to existing plants
        for (let i = 0; i < existingPlants.length; i++) {
            const plant = existingPlants[i];
            const assignedSlot = i + 1; // First plant gets slot 1, second gets slot 2
            
            if (assignedSlot > 2) {
                console.log(`Warning: More than 2 plants found. Plant ${plant._id} will be deleted.`);
                await Planted.deleteOne({ _id: plant._id });
                continue;
            }
            
            console.log(`Assigning slot ${assignedSlot} to plant: ${plant.plant?.name || 'Unknown'}`);
            
            await Planted.updateOne(
                { _id: plant._id },
                {
                    $set: {
                        slot: assignedSlot,
                        plantedAt: plant.createdAt || Date.now(),
                        status: Date.now() >= plant.harvestTime ? 'ready' : 'growing',
                        updatedAt: new Date()
                    }
                }
            );
        }
        
        // Create unique index on slot to prevent duplicates
        try {
            await Planted.collection.createIndex({ slot: 1 }, { unique: true });
            console.log('Created unique index on slot field');
        } catch (error) {
            console.log('Index might already exist:', error.message);
        }
        
        // Verify migration
        const migratedPlants = await Planted.find({});
        console.log(`Migration completed. Total plants: ${migratedPlants.length}`);
        
        migratedPlants.forEach(plant => {
            console.log(`- Slot ${plant.slot}: ${plant.plant?.name || 'Unknown'} (${plant.status})`);
        });
        
        console.log('Migration successful!');
        
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Rollback function in case something goes wrong
async function rollbackMigration() {
    try {
        console.log('Rolling back migration...');
        
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name');
        
        // Remove slot field from all documents
        await Planted.updateMany(
            {},
            {
                $unset: { 
                    slot: "",
                    plantedAt: "",
                    status: ""
                }
            }
        );
        
        // Drop the unique index
        try {
            await Planted.collection.dropIndex({ slot: 1 });
            console.log('Dropped slot index');
        } catch (error) {
            console.log('Index might not exist:', error.message);
        }
        
        console.log('Rollback completed');
        
    } catch (error) {
        console.error('Rollback failed:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Check current data state
async function checkDataState() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://rizki123:s4s4g3y0@cluster0.guinnfo.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');
        
        const allPlants = await Planted.find({});
        console.log(`Total planted in database: ${allPlants.length}`);
        
        const plantsWithSlots = await Planted.find({ slot: { $exists: true } });
        console.log(`Planted with slots: ${plantsWithSlots.length}`);
        
        const plantsWithoutSlots = await Planted.find({ 
            $or: [
                { slot: { $exists: false } },
                { slot: null }
            ]
        });
        console.log(`Plants without slots: ${plantsWithoutSlots.length}`);
        
        console.log('\nDetailed breakdown:');
        allPlants.forEach((plant, index) => {
            console.log(`${index + 1}. Plant: ${plant.plant?.name || 'Unknown'}`);
            console.log(`   - ID: ${plant._id}`);
            console.log(`   - Slot: ${plant.slot || 'Not assigned'}`);
            console.log(`   - Status: ${plant.status || 'Not set'}`);
            console.log(`   - Harvest Time: ${new Date(plant.harvestTime).toLocaleString()}`);
            console.log(`   - Ready: ${Date.now() >= plant.harvestTime ? 'Yes' : 'No'}`);
            console.log('');
        });
        
    } catch (error) {
        console.error('Error checking data state:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Run migration based on command line argument
const command = process.argv[2];

switch (command) {
    case 'migrate':
        migrateToDualPlantSystem();
        break;
    case 'rollback':
        rollbackMigration();
        break;
    case 'check':
        checkDataState();
        break;
    default:
        console.log('Usage:');
        console.log('  node migration.js check     - Check current data state');
        console.log('  node migration.js migrate   - Migrate to dual plant system');
        console.log('  node migration.js rollback  - Rollback migration');
        break;
}

module.exports = {
    migrateToDualPlantSystem,
    rollbackMigration,
    checkDataState
};