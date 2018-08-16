# Little script to help create markers.json and set up the directory structure in one go.

import json
import shutil
import sys
import os

#the path relative to which the browser will make requests from
webBasePath = 'content'

#the path we're putting stuff into
baseOutputPath = 'content/markers'

#the path we're copying images etc. from
inputPath = 'material'

totalOutputObject = []

directoriesUsed = []
indent = '    '
def processEntry(entry):
    #sort out directory and stuff
    dirName = entry['markerDirectory']
    outputObject = {}
    print('Processing input marker with directory {}'.format(entry['markerDirectory']))

    if dirName in directoriesUsed:
        raise ValueError('Marker directory {} is already used '.format(dirName))

    outputPath = os.path.join(baseOutputPath, dirName)
    webPath = os.path.relpath(outputPath, webBasePath)
    if not os.path.isdir(outputPath):
        print('{}Creating directory {}...'.format(indent, outputPath))
        os.mkdir(outputPath)
    else:
        print('{}{} already exists'.format(indent, outputPath))
    
    #handle the copy directives
    for copyEntry in entry['copy']:
        fromPath = os.path.join(inputPath, copyEntry['from'])
        toPath = os.path.join(outputPath, copyEntry['to'])

        print('{}Copy: {} -> {}...'.format(indent, fromPath, toPath))
        shutil.copy(fromPath, toPath)
    
    #handle "simple article" shortcut
    if 'simpleArticle' in entry:
        outputObject['article'] = {
            'type': 'html',
            'src': os.path.join(webPath, 'article.html')
        }
        with open(os.path.join(outputPath, 'article.html'), 'w') as articleFile:
            articleFile.write('<p>{}</p>'.format(entry['simpleArticle']['text']))
    
    #handle "simple image" shortcut
    if 'simpleImage' in entry:
        outputObject['media'] = {
            'type': 'image',
            'src': os.path.join(webPath, entry['simpleImage'])
        }
    
    outputObject['name'] = 'Placeholder Marker Name'
    outputObject['coords'] = entry['latLong']
    totalOutputObject.append(outputObject)
        


def main():
    if '-clean' in sys.argv:
        print('Cleanup mode. Deleting {}...'.format(baseOutputPath))
        shutil.rmtree(baseOutputPath)
        print('Recreating {}'.format(baseOutputPath))
        os.mkdir(baseOutputPath)

    allJson = json.load(open(os.path.join(inputPath, 'material.json'), 'r'))
    for entry in allJson:
        processEntry(entry)

    with open(os.path.join(webBasePath, 'markers.json'), 'w') as outputFile:
        print('Writing marker specifiers to {}...', outputFile.name)
        json.dump(totalOutputObject, outputFile, indent=4)

main()