<template>
  <v-chart ref="chart" :autoresize="true" :option="option" @click="handleClick"/>
</template>

<script setup>

import VChart from "vue-echarts";
import {getCurrentInstance, ref} from "vue";
import {use} from 'echarts/core';
import {
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent
} from 'echarts/components';
import {LineChart} from 'echarts/charts';
import {UniversalTransition} from 'echarts/features';
import {CanvasRenderer} from 'echarts/renderers';
import GpxProcess from "@/components/Control/gpxProcess";

use([
  GridComponent,
  MarkPointComponent,
  MarkLineComponent,
  ToolboxComponent,
  DataZoomComponent,
  TitleComponent,
  TooltipComponent,
  LineChart,
  CanvasRenderer,
  UniversalTransition,
]);

let speedRatio = 1;
let gpx;//gpx对象
let index;//当前索引
let chartData;//图表数据
let timeDelta;//时间间隔序列
let dataLength;//点的数量

const speedFormatter = [
  {
    markLineY: '{c} m/s',
    tooltip: (params) => {
      return `${params[0].data.value[1].toFixed(2)}m/s`;
    }
  }, {
    markLineY: '{c} km/h',
    tooltip: params => {
      return `${params[0].data.value[1].toFixed(2)}km/h`;
    }
  }, {
    markLineY: params => {
      let min = Math.trunc(params.data.value);
      let sec = Math.trunc((params.data.value - min) * 60);
      if (sec < 10) sec = '0' + sec;
      return min + ':' + sec;
    },
    tooltip: params => {
      let value = params[0].data.value[1];
      let min = Math.trunc(value);
      let sec = Math.trunc((value - min) * 60);
      if (sec < 10) sec = '0' + sec;
      return min + ':' + sec + '/km';
    }
  }
];

const option = ref({
  title: {text: 'GPXbox', left: 'center', zlevel: 2},
  tooltip: {
    trigger: 'axis',
    formatter: speedFormatter[0].tooltip,
    axisPointer: {
      type: 'cross',
      animation: true,
      snap: true
    }
  },
  xAxis: {
    type: 'time',
    splitLine: {
      show: false
    },
    boundaryGap: false
  },
  yAxis: {
    type: 'value',
    scale: true,
    boundaryGap: ['0%', '0%'],
    splitNumber: 2
  },
  toolbox: {
    zlevel: 2,
    show: true,
    left: '10%',
    feature: {
      saveAsImage: {},
      dataZoom: {
        yAxisIndex: 'none'
      }
    }
  },
  dataZoom: [
    {
      type: 'slider',
      xAxisIndex: 0,
      filterMode: 'filter'
    }, {
      type: 'slider',
      yAxisIndex: 0,
      filterMode: 'none',
      left: '92%'
    }
  ],
  series: [
    {
      type: 'line',
      smooth: true,
      showSymbol: false,
      markLine: {
        symbol: 'none',
        data: [
          {
            symbol: 'circle',
            label: {
              position: 'end',
              backgroundColor: "rgba(143,243,192,0.5)",
              borderRadius: [4, 4, 4, 4],
              padding: [5, 5, 5, 5],
              formatter: (input) => {
                return new Date(input.data.coord[0]).toLocaleString();
              }
            },
            xAxis: 0
          },
          {
            symbol: 'circle',
            yAxis: 0,
            label: {
              position: 'start',
              backgroundColor: "rgba(143,243,192,0.75)",
              borderRadius: [4, 4, 4, 4],
              padding: [5, 5, 5, 5],
              formatter: speedFormatter[0].markLineY
            }
          }
        ]
      },
      markPoint: {
        data: [],
        symbol: "circle",
        label: {
          show: false
        },
        symbolSize: 6,
        itemStyle: {
          color: "rgba(255, 0, 0, 1)"
        }
      }
    }
  ],
});

const chart = ref();
const eventBus = getCurrentInstance().appContext.config.globalProperties.$bus;

let setTimeoutID = [];

const clearID = () => {
  const idLength = setTimeoutID.length;
  for (let i = 0; i < idLength; i++) {
    clearTimeout(setTimeoutID[i]);
  }
  setTimeoutID = [];
}

const setMarkLineData = i => {
  option.value.series[0].markLine.data[0].xAxis = chartData[i].value[0];
  option.value.series[0].markLine.data[1].yAxis = chartData[i].value[1];
  option.value.series[0].markPoint.data[0] = {coord: chartData[i].value};
}

const handleClick = params => {
  clearID();
  const i = params.dataIndex;
  eventBus.$emit('indexChanged', i);
  setMarkLineData(i);
  index = i;
}

eventBus.$on("fileRead", file => {
  clearID();
  option.value.title.text = file.name;
  const fr = new FileReader();
  // 读取GPX文件
  fr.readAsText(file, 'utf-8');
  fr.onload = () => {
    gpx = new GpxProcess(fr.result);

    index = 0;
    chartData = gpx.getData();
    option.value.series[0].data = chartData;

    const timeArr = gpx.getTimeArr();
    dataLength = chartData.length;
    timeDelta = new Array(dataLength);

    for (let i = 0; i < dataLength; i++) {
      timeDelta[i] = timeArr[i + 1] - timeArr[i];
    }
    timeDelta[dataLength - 1] = 0;

    eventBus.$emit('sendPolyline', gpx.toPolyline());
    eventBus.$emit('statsData', gpx.getStats());
  }
});

eventBus.$on('speedRatioChanged', (sc) => {
  speedRatio = sc;
});

eventBus.$on('play', () => {
  clearID();
  const set = () => {
    if (index++ < dataLength) {
      setMarkLineData(index);//更新图表数据
      eventBus.$emit('indexChanged', index);//更新面板和地图数据
      setTimeoutID.push(setTimeout(set, timeDelta[index] / speedRatio));
    } else {
      clearID();
    }
  }
  setTimeoutID.push(setTimeout(set, timeDelta[index] / speedRatio));
});

eventBus.$on('playReversed', () => {
  clearID();
  const set = () => {
    if (index--) {
      setMarkLineData(index);//更新图表数据
      eventBus.$emit('indexChanged', index);//更新面板和地图数据
      setTimeoutID.push(setTimeout(set, timeDelta[index] / speedRatio));
    } else {
      clearID();
    }
  }
  setTimeoutID.push(setTimeout(set, timeDelta[index] / speedRatio));
});

eventBus.$on('pause', clearID);

eventBus.$on('backToStart', () => {
  index = 0;
  setMarkLineData(0);
});

eventBus.$on('unitOfSpeedChanged', key => {
  if (key === 0) {
    chartData = gpx.getData();
  } else if (key === 1) {
    chartData = gpx.getDataAsKmPreHour();
  } else if (key === 2) {
    chartData = gpx.getDataAsMinutePerKm();
  } else {
    console.log(key);
  }
  option.value.series[0].markLine.data[1].label.formatter = speedFormatter[key].markLineY;
  option.value.tooltip.formatter = speedFormatter[key].tooltip;
  option.value.series[0].data = chartData;
  setMarkLineData(index);
});

eventBus.$on('sliderValueChanged', i => {
  clearID();
  index = i;
  setMarkLineData(i);
});

</script>

<style scoped>
</style>
