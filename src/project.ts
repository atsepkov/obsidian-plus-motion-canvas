import {makeProject} from '@motion-canvas/core';

import tag from './scenes/tag?scene';
import task from './scenes/task?scene';
import application from './scenes/application?scene';
import externalApi from './scenes/external_api?scene';

export default makeProject({
  scenes: [tag, task, application, externalApi],
});
