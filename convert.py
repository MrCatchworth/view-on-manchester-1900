# Little script to help create markers.json and set up the directory structure in one go.

import json
import shutil
import sys
import os
from PIL import Image

#the path relative to which the browser will make requests from
webBasePath = 'content'

#the path we're putting stuff into
baseOutputPath = 'content/markers'

#the path we're copying images etc. from
inputPath = 'material'

# the max size of generated thumbnails
thumbnailSize = 150, 96

totalOutputObject = {}

directoriesUsed = []
indent = '    '
def processEntry(entry):
    #sort out directory and stuff
    dirName = entry['markerDirectory']
    outputObject = {}
    print('Processing input marker with directory {}'.format(entry['markerDirectory']))

    if dirName in directoriesUsed:
        raise ValueError('Marker directory {} is already used '.format(dirName))

    #the path where stuff for this marker should go
    outputPath = os.path.join(baseOutputPath, dirName)

    #the path from the base web path to the marker's directory
    webPath = os.path.relpath(outputPath, webBasePath)

    if not os.path.isdir(outputPath):
        print('{}Creating directory {}...'.format(indent, outputPath))
        os.mkdir(outputPath)
    else:
        print('{}{} already exists'.format(indent, outputPath))

    #generate the thumbnail image
    if 'thumb' in entry:
        thumbPath = entry['thumb']
        print('{}Generating thumbnail from {}...'.format(indent, thumbPath))
        thumbOutPath = os.path.join(outputPath, 'thumb.jpg')

        thumbImage = Image.open(os.path.join(inputPath, thumbPath))
        thumbImage.thumbnail(thumbnailSize)
        thumbImage.save(thumbOutPath, 'JPEG')

        outputObject['thumb'] = os.path.join(webPath, 'thumb.jpg')
    
    #handle the copy directives
    for copyEntry in entry['copy']:
        fromPath = os.path.join(inputPath, copyEntry['from'])
        toPath = os.path.join(outputPath, copyEntry['to'])

        print('{}Copy: {} -> {}...'.format(indent, fromPath, toPath))
        shutil.copy(fromPath, toPath)
    
    #"simple article" shortcut
    if 'simpleArticle' in entry:
        outputObject['article'] = {
            'type': 'html',
            'src': os.path.join(webPath, 'article.html')
        }
        with open(os.path.join(outputPath, 'article.html'), 'w') as articleFile:
            articleFile.write('<p>{}</p>'.format(entry['simpleArticle']['text']))
    #literal article spec
    elif 'article' in entry:
        outputObject['article'] = entry['article']
    else:
        print('{}Warning: {} will have no article spec!'.format(indent, dirName))
    
    #"simple image" shortcut
    if 'simpleImage' in entry:
        outputObject['media'] = {
            'type': 'image',
            'src': os.path.join(webPath, entry['simpleImage'])
        }
    #image comparison shortcut
    elif 'imageComparison' in entry:
        srcBack = os.path.join(webPath, entry['imageComparison'][0])
        srcFront = os.path.join(webPath, entry['imageComparison'][1])
        outputObject['media'] = {
            'type': 'imageComparison',
            'srcBack': srcBack,
            'srcFront': srcFront
        }
    #literal media spec
    elif 'media' in entry:
        outputObject['media'] = entry['media']
    else:
        print('{}Warning: {} will have no media spec!'.format(indent, dirName))
    
    outputObject['name'] = 'Placeholder Marker Name'
    outputObject['coords'] = entry['latLong']
    totalOutputObject['markers'].append(outputObject)
        


def main():
    if '-clean' in sys.argv:
        print('Cleanup mode. Deleting {}...'.format(baseOutputPath))
        shutil.rmtree(baseOutputPath)
        print('Recreating {}'.format(baseOutputPath))
        os.mkdir(baseOutputPath)

    allJson = json.load(open(os.path.join(inputPath, 'material.json'), 'r'))
    totalOutputObject['groups'] = allJson['groups']
    totalOutputObject['markers'] = []
    for entry in allJson['markers']:
        processEntry(entry)
    
    

    with open(os.path.join(webBasePath, 'markers.json'), 'w') as outputFile:
        print('Writing json to {}...'.format(outputFile.name))
        json.dump(totalOutputObject, outputFile, indent=4)

main()