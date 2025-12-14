
const illegalKeywords = ['child', 'minor', 'childhood', 'children', 'underage', 'kid', 'young child', 'prepubescent'];
const sexualKeywords = ['nude', 'vagina', 'penis', 'naked', 'sex', 'sexual', 'explicit', 'erotic'];

function checkForIllegalContent(text) {
    if (!text) return false;

    return illegalKeywords.some(keyword => {
        // FIXED REGEX: Using [\s\S] to match across newlines
        const keywordRegex = new RegExp(`(${keyword})[\\s\\S]*?(nude|vagina|penis|naked|sex|sexual|explicit)|(nude|vagina|penis|naked|sex|sexual|explicit)[\\s\\S]*?(${keyword})`, 'i');
        return keywordRegex.test(text);
    });
}

function checkForIllegalContentInTags(tags) {
    if (!tags || tags.length === 0) return false;

    const hasIllegalSubject = tags.some(tag =>
        illegalKeywords.some(keyword => tag.toLowerCase().includes(keyword))
    );



    const hasSexualContent = tags.some(tag =>
        sexualKeywords.some(keyword => tag.toLowerCase().includes(keyword))
    );

    return hasIllegalSubject && hasSexualContent;
}

console.log('--- Test Regex Newline (Should be TRUE now) ---');
console.log("'child' and 'naked' on same line:", checkForIllegalContent("There is a child and they are naked"));
console.log("'child' and 'naked' on different lines:", checkForIllegalContent("There is a child\nand they are naked"));

console.log('--- Test Tags Logic (Should be TRUE now) ---');
const hazardousTags = ['child', 'beach', 'naked'];
console.log("Tags ['child', 'beach', 'naked']:", checkForIllegalContentInTags(hazardousTags));

console.log('--- Test Safe Tags (Should be FALSE) ---');
const safeTags = ['child', 'beach', 'playing'];
console.log("Tags ['child', 'beach', 'playing']:", checkForIllegalContentInTags(safeTags));
