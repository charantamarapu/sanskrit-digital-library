const mongoose = require('mongoose');
const axios = require('axios');
const Verse = require('./models/Verse');
const Commentary = require('./models/Commentary');
require('dotenv').config();

const GITHUB_BASE_URL = 'https://raw.githubusercontent.com/charantamarapu/sanskrit-library-data/main';

// Function to extract content from markdown
const extractContent = (markdown) => {
    if (!markdown) return '';
    const parts = markdown.split('---');
    if (parts.length >= 3) {
        return parts.slice(2).join('---').trim();
    }
    return markdown;
};

// Fetch content from GitHub
const fetchFromGitHub = async (githubPath) => {
    try {
        const response = await axios.get(githubPath);
        return extractContent(response.data);
    } catch (error) {
        console.error(`Error fetching ${githubPath}:`, error.message);
        return null;
    }
};

async function migrateVerses() {
    console.log('Starting verse migration...');
    
    const verses = await Verse.find({ githubPath: { $exists: true, $ne: null } });
    console.log(`Found ${verses.length} verses to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const verse of verses) {
        try {
            console.log(`Migrating verse ${verse._id}...`);
            
            // Fetch content from GitHub
            const content = await fetchFromGitHub(verse.githubPath);
            
            if (content) {
                // Update verse with content and remove githubPath
                verse.verseText = content;
                verse.githubPath = undefined;
                await verse.save();
                
                successCount++;
                console.log(`✓ Migrated verse ${verse._id}`);
            } else {
                errorCount++;
                console.log(`✗ Failed to fetch content for verse ${verse._id}`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            errorCount++;
            console.error(`✗ Error migrating verse ${verse._id}:`, error.message);
        }
    }
    
    console.log(`\nVerse Migration Complete:`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
}

async function migrateCommentaries() {
    console.log('\nStarting commentary migration...');
    
    const commentaries = await Commentary.find({ githubPath: { $exists: true, $ne: null } });
    console.log(`Found ${commentaries.length} commentaries to migrate`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const commentary of commentaries) {
        try {
            console.log(`Migrating commentary ${commentary._id}...`);
            
            // Fetch content from GitHub
            const content = await fetchFromGitHub(commentary.githubPath);
            
            if (content) {
                // Update commentary with content and remove githubPath
                commentary.commentaryText = content;
                commentary.githubPath = undefined;
                await commentary.save();
                
                successCount++;
                console.log(`✓ Migrated commentary ${commentary._id}`);
            } else {
                errorCount++;
                console.log(`✗ Failed to fetch content for commentary ${commentary._id}`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            errorCount++;
            console.error(`✗ Error migrating commentary ${commentary._id}:`, error.message);
        }
    }
    
    console.log(`\nCommentary Migration Complete:`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors: ${errorCount}`);
}

async function main() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB\n');
        
        // Run migrations
        await migrateVerses();
        await migrateCommentaries();
        
        console.log('\n✅ Migration completed successfully!');
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

main();
